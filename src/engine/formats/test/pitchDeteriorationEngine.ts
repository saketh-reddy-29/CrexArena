import { TestMatchState } from './testTypes';

export class PitchDeteriorationEngine {
  public deterioratePitch(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    
    // Deteriorate based on balls bowled
    currentState.pitch.roughness += 0.01;
    currentState.pitch.deterioration += 0.01;
    
    // Adjust pace, bounce, spin based on day/deterioration
    if (currentState.day >= 4) {
       currentState.pitch.spin += 0.02;
       currentState.pitch.pace -= 0.01;
       currentState.pitch.bounce -= 0.01;
    }
    
    return currentState;
  }
}

export const pitchDeteriorationEngine = new PitchDeteriorationEngine();
