/**
 * Quit-risk score (0-100) from overtime load, fatigue, attendance drop, unresolved complaints and
 * team sentiment, with the top three reasons. Pure.
 */

import type { QuitRiskInput, QuitRiskResult, QuitRiskFactor } from '../../shared/types';

/**
 * Calculates a 0-100 attrition risk score and identifies the top 3 contributing factors.
 */
export function calculateQuitRisk(input: QuitRiskInput): QuitRiskResult {
  const { weeklyHours, fatigueFlags, attendanceDropPct, unresolvedComplaints, teamFeedbackTrend } =
    input;

  const candidateFactors: QuitRiskFactor[] = [];

  // 1. Overtime Load (Weight up to 30)
  if (weeklyHours > 48) {
    const excessHours = weeklyHours - 48;
    // Scale excess: 12 excess hours (60h total) reaches full 30 pts
    const otScore = Math.min(30, Math.round((excessHours / 12) * 30));
    candidateFactors.push({
      factor: 'ot_load',
      weight: otScore,
      detail: `Weekly workload of ${weeklyHours}h exceeds the 48h threshold (+${excessHours}h)`,
    });
  }

  // 2. Fatigue Flags (Weight up to 25)
  if (fatigueFlags && fatigueFlags.length > 0) {
    const flagScore = Math.min(25, fatigueFlags.length * 8);
    const types = Array.from(new Set(fatigueFlags.map((f) => f.type))).join(', ');
    candidateFactors.push({
      factor: 'fatigue_flags',
      weight: flagScore,
      detail: `${fatigueFlags.length} active fatigue flag(s) detected (${types})`,
    });
  }

  // 3. Attendance Drop (Weight up to 20)
  if (attendanceDropPct > 5) {
    // 25% drop reaches max 20 pts
    const dropScore = Math.min(20, Math.round((attendanceDropPct / 25) * 20));
    candidateFactors.push({
      factor: 'attendance_drop',
      weight: dropScore,
      detail: `Monthly shift attendance dropped by ${Math.round(attendanceDropPct)}%`,
    });
  }

  // 4. Unresolved Complaints / Grievances (Weight up to 15)
  if (unresolvedComplaints > 0) {
    const complaintScore = Math.min(15, unresolvedComplaints * 5);
    candidateFactors.push({
      factor: 'unresolved_complaints',
      weight: complaintScore,
      detail: `${unresolvedComplaints} open grievance(s) or safety hazard report(s) awaiting resolution`,
    });
  }

  // 5. Team Feedback Sentiment Trend (Weight up to 10)
  // Scores below 3.5 on a 1-5 scale increase risk
  if (teamFeedbackTrend > 0 && teamFeedbackTrend < 3.5) {
    const gap = 3.5 - teamFeedbackTrend; // max gap is 2.5 (1.0 rating)
    const sentimentScore = Math.min(10, Math.round((gap / 2.5) * 10));
    if (sentimentScore > 0) {
      candidateFactors.push({
        factor: 'team_sentiment',
        weight: sentimentScore,
        detail: `Low peer workplace sentiment (${teamFeedbackTrend.toFixed(1)} / 5.0 team average)`,
      });
    }
  }

  // Total score sum, capped between 0 and 100
  const rawScore = candidateFactors.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.min(100, Math.max(0, rawScore));

  // Sort descending by weight to get the top 3 drivers
  const topReasons = [...candidateFactors].sort((a, b) => b.weight - a.weight).slice(0, 3);

  // If score is 0 or no factors triggered, provide standard baseline
  if (topReasons.length === 0) {
    topReasons.push({
      factor: 'normal_conditions',
      weight: 0,
      detail: 'Consistent attendance, manageable hours, and positive team climate',
    });
  }

  return {
    score,
    topReasons,
  };
}
