import { TestMatchState } from './testTypes';

export class TestCaptainAI {
  public decideDeclaration(state: TestMatchState): boolean {
    // Advanced AI to decide declaration based on match state
    return false;
  }
  
  public decideFollowOn(state: TestMatchState): boolean {
    // Advanced AI to decide follow-on based on match state
    return true;
  }
}

export const testCaptainAI = new TestCaptainAI();
