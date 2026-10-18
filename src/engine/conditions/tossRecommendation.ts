import type {
  MatchConditionsModel,
  MatchFormatKey,
  PitchProfile,
  TossFactor,
  TossRecommendation,
  WeatherProfile,
  VenueProfile,
} from './types';
import { clamp, round } from './rng';

export interface TossEvaluationContext {
  format: MatchFormatKey;
  conditions: MatchConditionsModel;
  pitch: PitchProfile;
  weather: WeatherProfile;
  venue: VenueProfile;
  /** Batting depth of the toss-winning team, 0..100. */
  teamBattingDepth: number;
  /** Bowling strength of the toss-winning team, 0..100. */
  teamBowlingStrength: number;
  /** Test day (defaults to conditions.day). */
  day?: number;
}

/**
 * Intelligent, fully transparent toss advisor.
 *
 * CRITICAL DESIGN CONTRACT:
 *   - This engine only estimates whether batting or bowling first is favoured.
 *   - It is decision support (a "score", not a win probability).
 *   - It never forces a result, never awards runs, and never changes a delivery
 *     outcome. The user is always free to choose the opposite option, and the
 *     AI captain chooses independently using its own reading of conditions.
 */
export class TossRecommendationEngine {
  static evaluate(ctx: TossEvaluationContext): TossRecommendation {
    const { format, conditions, pitch, weather, venue } = ctx;
    const day = ctx.day ?? conditions.day;

    const factors: TossFactor[] = [];

    const push = (label: string, contribution: number, detail: string) => {
      if (Math.abs(contribution) < 0.01) return;
      factors.push({ label, contribution: round(contribution, 2), detail });
    };

    // 1. New-ball seam & swing: bowl first to exploit it early.
    const newBallMovement = conditions.seamAssist * 0.6 + conditions.swingAssist * 0.4;
    push(
      'New-ball movement',
      -(newBallMovement - 0.4) * 22,
      newBallMovement >= 0.5
        ? `Seam and swing are on offer early (${Math.round(newBallMovement * 100)}% assistance) — bowl first and use it.`
        : 'Minimal assistance with the new ball, so the early-bowl incentive is small.',
    );

    // 2. Pitch deterioration (Tests): bat first, before it breaks up.
    if (format === 'TEST') {
      push(
        'Pitch deterioration',
        conditions.deterioration * 24,
        conditions.deterioration >= 0.3
          ? `Surface is breaking up (day ${day}) — batting last looks tough. Set a total first.`
          : 'Little deterioration expected — the pitch should hold together.',
      );
    }

    // 3. Dry/turning surface: bat first to avoid facing it last.
    const turnMinusDew = conditions.spinAssist - conditions.dewGripPenalty * 0.8;
    push(
      'Spin conditions',
      turnMinusDew * 14,
      turnMinusDew >= 0.35
        ? 'The surface will take turn — batting last on it is a risk.'
        : conditions.dewGripPenalty >= 0.35
          ? 'Dew will blunt the spinners later, reducing the case for batting first.'
          : 'Neutral spin conditions.',
    );

    // 4. Dew (day/night limited overs): bowl first, chase under lights.
    if (format !== 'TEST') {
      push(
        'Dew factor',
        -conditions.dewGripPenalty * 34,
        conditions.dewGripPenalty >= 0.3
          ? 'Significant dew expected — chasing is easier once the ball gets wet. Bowl first.'
          : 'Dew is unlikely to change the equation.',
      );
    }

    // 5. Batting-friendly surface + fast outfield + small ground.
    const chaseEase = (conditions.boundaryFactor - 1) * 40 + (conditions.outfieldFactor - 1) * 30;
    push(
      'Ground & outfield',
      -chaseEase,
      chaseEase > 4
        ? 'Short boundaries and a fast outfield make chasing attractive.'
        : chaseEase < -4
          ? 'A big ground and slow outfield make defending a total viable.'
          : 'Ground dimensions are neutral.',
    );

    // 6. Flat deck: in longer formats, post a score first.
    if (format !== 'T20' && format !== 'IPL') {
      push(
        'Batting paradise',
        (0.45 - conditions.battingDifficulty) * 12,
        conditions.battingDifficulty <= 0.35
          ? 'A flat surface rewards batting first with a big total.'
          : conditions.battingDifficulty >= 0.6
            ? 'A difficult surface — bowlers are in the game throughout.'
            : 'A fair contest between bat and ball.',
      );
    }

    // 7. Test weather: bat first to leave time for a result.
    if (format === 'TEST' && conditions.drawRisk > 0) {
      push(
        'Weather & time',
        conditions.drawRisk * 14,
        conditions.drawRisk >= 0.35
          ? 'Rain is likely to eat overs — batting first maximises the chance of a result.'
          : 'Weather looks clear enough for a full contest.',
      );
    }

    // 8. Team strength: bat first if you bat deep, bowl first if you have a strong attack.
    const strengthDelta = clamp((ctx.teamBattingDepth - ctx.teamBowlingStrength) / 100, -1, 1);
    push(
      'Team balance',
      strengthDelta * 18,
      strengthDelta > 0.1
        ? 'Your batting depth is a bigger weapon than the attack — back the batters first.'
        : strengthDelta < -0.1
          ? 'Your bowling is the stronger suit — put the opposition in.'
          : 'Bat and ball are evenly balanced in your side.',
    );

    // 9. Format baseline: chasing is generally easier in short formats.
    if (format === 'T20' || format === 'IPL') {
      push('Format tendency', -6, 'Short-format chasing is generally favoured, other things equal.');
    } else if (format === 'ODI') {
      push('Format tendency', -3, 'Limited-overs sides increasingly prefer to chase.');
    }

    const net = factors.reduce((s, f) => s + f.contribution, 0);
    const batFirstScore = round(clamp(50 + net, 2, 98), 0);
    const bowlFirstScore = round(100 - batFirstScore, 0);
    const recommendation: 'BAT' | 'BOWL' = net >= 0 ? 'BAT' : 'BOWL';
    const confidence = round(clamp(Math.abs(net) / 38, 0.05, 0.95), 2);

    const ordered = [...factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const rationale = ordered.slice(0, 3).map(f => f.detail);

    const alternative =
      recommendation === 'BAT'
        ? `Bowling first keeps the option of using the new ball in helpful conditions${conditions.dewGripPenalty >= 0.3 ? ' and lets you chase under dew' : ''}.`
        : 'Batting first puts runs on the board and avoids facing a deteriorated surface last.';

    return {
      format,
      recommendation,
      batFirstScore,
      bowlFirstScore,
      confidence,
      rationale: rationale.length > 0 ? rationale : ['Conditions are close to even — either call is defensible.'],
      alternative,
      factors: ordered,
    };
  }
}
