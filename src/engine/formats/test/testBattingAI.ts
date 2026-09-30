import { TestMatchState, BattingIntent } from './testTypes';

export class TestBattingAI {
  public decideIntent(state: TestMatchState, batter: any): BattingIntent {
    // Determine batting intent based on session, score, pitch, etc.
    if (state.wickets > 7) return "ATTACK";
    if (state.balls < 30) return "SURVIVE";
    return "NORMAL";
  }
}

export const testBattingAI = new TestBattingAI();
