import { TestMatchState } from './testTypes';

export class DeclarationEngine {
  public checkDeclaration(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    
    // AI decision to declare (mocked)
    if (currentState.inningsNumber === 3 && currentState.score > 300 && currentState.wickets > 5) {
      const aiWantsToDeclare = Math.random() > 0.95; 
      if (aiWantsToDeclare) {
        currentState.inningsStatus = "DECLARED";
      }
    }
    
    return currentState;
  }
}

export const declarationEngine = new DeclarationEngine();
