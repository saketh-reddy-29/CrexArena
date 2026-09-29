import { Competition, Fixture, StageType } from "./types";

export class FixtureEngine {
  /**
   * Generates a single or double round-robin fixture list for a given set of teams
   */
  public generateLeagueFixtures(
    competition: Competition, 
    stageType: StageType, 
    doubleRoundRobin: boolean = false
  ): Fixture[] {
    const teams = [...competition.teams];
    const fixtures: Fixture[] = [];
    
    // Standard Round Robin generation algorithm
    if (teams.length % 2 !== 0) {
      teams.push("BYE");
    }

    const totalRounds = teams.length - 1;
    const matchesPerRound = teams.length / 2;

    for (let round = 0; round < totalRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = teams[match];
        const away = teams[teams.length - 1 - match];

        if (home !== "BYE" && away !== "BYE") {
          // Add standard fixture
          fixtures.push(this.createFixture(competition.id, stageType, home, away));
          
          if (doubleRoundRobin) {
            // Add reverse fixture
            fixtures.push(this.createFixture(competition.id, stageType, away, home));
          }
        }
      }
      
      // Rotate array for next round (keep first element fixed)
      const last = teams.pop()!;
      teams.splice(1, 0, last);
    }

    return fixtures;
  }
  
  public generateSeriesFixtures(
    competition: Competition,
    homeTeam: string,
    awayTeam: string,
    numberOfMatches: number
  ): Fixture[] {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < numberOfMatches; i++) {
      fixtures.push(this.createFixture(competition.id, "LEAGUE", homeTeam, awayTeam));
    }
    return fixtures;
  }

  private createFixture(competitionId: string, stageType: StageType, homeTeamId: string, awayTeamId: string): Fixture {
    return {
      id: `fix_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      competitionId,
      stageType,
      homeTeamId,
      awayTeamId,
      status: "SCHEDULED"
    };
  }
}
