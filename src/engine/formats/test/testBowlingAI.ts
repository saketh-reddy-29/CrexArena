import { TestMatchState, BowlingSpell } from './testTypes';

export class TestBowlingAI {
  public selectBowler(state: TestMatchState, availableBowlers: any[]): any {
    // Determine the best bowler considering spells, fatigue, pitch
    // Returning first available bowler as mock
    return availableBowlers[0];
  }
}

export const testBowlingAI = new TestBowlingAI();
