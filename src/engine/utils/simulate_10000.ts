import { RulesEngine } from '../rules/RulesEngine';
import { MatchSituationEngine } from '../core/MatchSituationEngine';
import { DeliveryEngine } from '../core/DeliveryEngine';

const mockRulesConfig = {
  type: 'T20',
  innings: {
    oversPerInnings: 20
  },
  maxInnings: 2,
};

class MockRulesEngine extends RulesEngine {
  constructor() {
    super(mockRulesConfig as any);
  }
}

async function simulate10000() {
  const rules = new MockRulesEngine();
  const situationEngine = new MatchSituationEngine(rules);
  const deliveryEngine = new DeliveryEngine(rules, situationEngine);

  const stats = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    6: 0,
    wicket: 0,
    extras: 0,
  };

  const batter = { id: 'b1', rating: 80, attributes: { power: 85, aggression: 80, technique: 75 } };
  const bowler = { id: 'bw1', rating: 82, attributes: { bowlingRating: 85 } };

  for (let i = 0; i < 10000; i++) {
    const context = {
      batter,
      bowler,
      inningsState: { runs: 50, wickets: 2, balls: 60, deliveries: [], isDeclared: false },
      target: 180,
      matchState: { format: 'T20', innings: [], status: 'IN_PROGRESS', result: null }
    };

    const outcome = deliveryEngine.simulateDelivery(context);

    if (outcome.isWicket) {
      stats.wicket++;
    } else if (outcome.extras > 0) {
      stats.extras++;
    } else {
      (stats as any)[outcome.runs]++;
    }
  }

  console.log('--- After 10,000 simulated deliveries ---');
  console.log(`0 runs     ${stats[0]}`);
  console.log(`1 run      ${stats[1]}`);
  console.log(`2 runs     ${stats[2]}`);
  console.log(`3 runs     ${stats[3]}`);
  console.log(`4 runs     ${stats[4]}`);
  console.log(`6 runs     ${stats[6]}`);
  console.log(`wickets    ${stats.wicket}`);
  console.log(`extras     ${stats.extras}`);
}

simulate10000();
