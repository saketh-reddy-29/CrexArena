import { RulesEngine } from '../rules/RulesEngine';
import { DeliveryEngine } from './DeliveryEngine';
import { MatchSituationEngine } from './MatchSituationEngine';
import { testMatchEngine } from '../formats/test/testMatchEngine';
import { TestMatchState, TestSession } from '../formats/test/testTypes';

export class MatchEngine {
  private rules: RulesEngine;
  private deliveryEngine: DeliveryEngine;
  private situationEngine: MatchSituationEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
    this.situationEngine = new MatchSituationEngine(rules);
    this.deliveryEngine = new DeliveryEngine(rules, this.situationEngine);
  }

  simulateMatch(teamA: any, teamB: any) {
    // 1. Toss
    const tossWinner = Math.random() > 0.5 ? teamA : teamB;
    const tossDecision = Math.random() > 0.5 ? 'BAT' : 'BOWL';

    let battingTeam = tossDecision === 'BAT' ? tossWinner : (tossWinner === teamA ? teamB : teamA);
    let bowlingTeam = tossDecision === 'BOWL' ? tossWinner : (tossWinner === teamA ? teamB : teamA);

    const matchState = {
      format: this.rules.getConfig().type,
      innings: [] as any[],
      status: 'IN_PROGRESS',
      result: null as any
    };

    if (matchState.format === 'TEST') {
      const initialTestState: TestMatchState = {
        day: 1,
        session: TestSession.MORNING,
        inningsNumber: 1,
        inningsStatus: "NOT_STARTED",
        score: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        timeRemaining: 5 * 6 * 2 * 60, // approximate
        oversToday: 0,
        weather: { condition: "SUNNY", lightLevel: 100 },
        pitch: { pace: 80, bounce: 80, seam: 60, swing: 50, spin: 40, deterioration: 0, roughness: 0 },
        ball: { inningsBallAge: 0, oversSinceNewBall: 0, isNewBall: true },
        result: "IN_PROGRESS",
        team1Score: 0,
        team2Score: 0,
        team1Name: teamA.name,
        team2Name: teamB.name,
        currentBattingTeam: battingTeam.name,
        currentBowlingTeam: bowlingTeam.name
      };
      
      const finalTestState = testMatchEngine.simulateMatch(initialTestState);
      matchState.status = 'COMPLETED';
      matchState.result = finalTestState.result;
      return matchState;
    }

    const maxInnings = this.rules.getMaxInnings();

    // 2. Play Innings
    for (let currentInnings = 1; currentInnings <= maxInnings; currentInnings++) {
      const inningsTarget = currentInnings > 1 ? this.calculateTarget(matchState.innings) : null;
      
      const inningsResult = this.simulateInnings(
        battingTeam, 
        bowlingTeam, 
        currentInnings, 
        inningsTarget, 
        matchState
      );
      
      matchState.innings.push(inningsResult);

      // Check for match completion
      if (this.isMatchComplete(matchState, currentInnings)) {
        break;
      }

      // Swap teams
      const temp = battingTeam;
      battingTeam = bowlingTeam;
      bowlingTeam = temp;
    }

    matchState.status = 'COMPLETED';
    matchState.result = this.calculateResult(matchState);

    return matchState;
  }

  private simulateInnings(battingTeam: any, bowlingTeam: any, inningsNumber: number, target: number | null, matchState: any) {
    const inningsState = {
      battingTeam: battingTeam.name,
      bowlingTeam: bowlingTeam.name,
      runs: 0,
      wickets: 0,
      balls: 0,
      deliveries: [] as any[],
      isDeclared: false
    };

    const maxOvers = this.rules.getMaxOvers();
    const maxBalls = maxOvers ? maxOvers * 6 : Infinity;

    while (inningsState.wickets < 10 && inningsState.balls < maxBalls) {
      // Simulate delivery
      const deliveryOutcome = this.deliveryEngine.simulateDelivery({
        inningsState,
        target,
        matchState,
        batter: { power: 80, timing: 85, strikeRate: 130, form: 90, formatRating: 88 }, // Mocks
        bowler: { accuracy: 85, variation: 80, paceOrSpin: 85, form: 85, formatRating: 82 } // Mocks
      });

      inningsState.balls += 1;
      inningsState.runs += deliveryOutcome.runs;
      
      if (deliveryOutcome.isWicket) {
        inningsState.wickets += 1;
      }

      inningsState.deliveries.push(deliveryOutcome);

      // Target reached in limited overs/run chase
      if (target && inningsState.runs >= target && this.rules.getConfig().type !== 'TEST') {
        break;
      }

      // Test match declaration logic placeholder
      if (this.rules.canDeclare() && this.shouldDeclare(inningsState, matchState)) {
        inningsState.isDeclared = true;
        break;
      }
    }

    return inningsState;
  }

  private calculateTarget(previousInnings: any[]) {
    return previousInnings.reduce((sum, inn) => sum + inn.runs, 0) + 1;
  }

  private isMatchComplete(matchState: any, currentInnings: number) {
    const isTest = this.rules.getConfig().type === 'TEST';
    if (!isTest) {
      if (currentInnings === 2) return true;
    } else {
      // Test match logic: 4 innings or 4th innings target reached
      if (currentInnings === 4) return true;
    }
    return false;
  }

  private shouldDeclare(inningsState: any, matchState: any) {
    // Placeholder for complex declaration logic
    return false; 
  }

  private calculateResult(matchState: any) {
    // Determine winner based on format
    return { winner: 'TBD', margin: 'TBD' };
  }
}
