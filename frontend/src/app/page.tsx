"use client";

import { useState, useEffect, useCallback } from "react";
import {
  connectWallet,
  readContract,
  writeContract,
  waitForTx,
  SCENARIO_ADDRESS,
  SUBMISSION_ADDRESS,
  SCORING_ADDRESS,
} from "@/lib/genlayer";
import styles from "./page.module.css";

type Phase = "idle" | "generating" | "submitting" | "scoring" | "results";

interface Scenario {
  round_id: string;
  environment: string;
  description: string;
  available_resources: string[];
  immediate_threat: string;
  difficulty: string;
  status: string;
}

interface ScoreResult {
  resourcefulness: number;
  realism: number;
  priority: number;
  overall_score: number;
  verdict: string;
  feedback: string;
}

interface LeaderboardEntry {
  player: string;
  total_rounds: number;
  total_score: number;
  best_score: number;
  survivor_count: number;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#4caf50",
  medium: "#f5a623",
  hard: "#e07c24",
  extreme: "#e05252",
};

const VERDICT_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  survivor: { label: "SURVIVED", color: "#4caf50", icon: "✓" },
  likely_survivor: { label: "LIKELY SURVIVED", color: "#7eeb7e", icon: "~" },
  unlikely_survivor: { label: "UNLIKELY SURVIVED", color: "#f5a623", icon: "!" },
  did_not_survive: { label: "DID NOT SURVIVE", color: "#e05252", icon: "✗" },
};

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function Home() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [plan, setPlan] = useState("");
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [txStatus, setTxStatus] = useState("");
  const [error, setError] = useState("");
  const [roundId, setRoundId] = useState("");

  const loadLeaderboard = useCallback(async () => {
    try {
      const raw = await readContract(SCORING_ADDRESS, "get_leaderboard", []);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && typeof data === "object") {
        const entries = Object.values(data) as LeaderboardEntry[];
        entries.sort((a, b) => b.best_score - a.best_score);
        setLeaderboard(entries.slice(0, 10));
      }
    } catch {
      // leaderboard empty or not loaded yet
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
    setRoundId(Date.now().toString());
  }, [loadLeaderboard]);

  async function handleConnect() {
    setError("");
    try {
      const addr = await connectWallet();
      setWallet(addr);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleGenerateScenario() {
    if (!wallet) return;
    setError("");
    setPhase("generating");
    setScenario(null);
    setScore(null);
    setPlan("");
    const newRound = Date.now().toString();
    setRoundId(newRound);
    try {
      setTxStatus("Requesting GenLayer AI to generate your scenario...");
      const hash = await writeContract(wallet, SCENARIO_ADDRESS, "generate_scenario", [newRound]);
      setTxStatus("Waiting for consensus... (this takes 30-90 seconds)");
      await waitForTx(hash);
      setTxStatus("Reading scenario...");
      // Small delay to ensure state is readable
      await new Promise((r) => setTimeout(r, 3000));
      const raw = await readContract(SCENARIO_ADDRESS, "get_scenario", [newRound]);
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || !parsed.environment) {
        throw new Error("Scenario not ready yet. Try again in a moment.");
      }
      setScenario(parsed as Scenario);
      setPhase("submitting");
      setTxStatus("");
    } catch (e) {
      setError(String(e));
      setPhase("idle");
      setTxStatus("");
    }
  }

  async function handleSubmitPlan() {
    if (!wallet || !scenario || !plan.trim()) return;
    setError("");
    setPhase("scoring");
    try {
      setTxStatus("Submitting your plan on-chain...");
      const subHash = await writeContract(wallet, SUBMISSION_ADDRESS, "submit_plan", [
        roundId,
        wallet,
        plan.trim(),
      ]);
      setTxStatus("Waiting for submission confirmation...");
      await waitForTx(subHash);

      setTxStatus("GenLayer AI is evaluating your survival plan...");
      const scenarioJson = JSON.stringify(scenario);
      const scoreHash = await writeContract(wallet, SCORING_ADDRESS, "score_plan", [
        roundId,
        wallet,
        scenarioJson,
        plan.trim(),
      ]);
      setTxStatus("Waiting for AI judgment... (this takes 30-90 seconds)");
      await waitForTx(scoreHash);
      setTxStatus("Reading your results...");
      await new Promise((r) => setTimeout(r, 3000));
      const raw = await readContract(SCORING_ADDRESS, "get_score", [roundId, wallet]);
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!result || result.overall_score === undefined) {
        throw new Error("Score not ready yet. Please try again.");
      }
      setScore(result as ScoreResult);
      setPhase("results");
      setTxStatus("");
      await loadLeaderboard();
    } catch (e) {
      setError(String(e));
      setPhase("submitting");
      setTxStatus("");
    }
  }

  function handlePlayAgain() {
    setPhase("idle");
    setScenario(null);
    setScore(null);
    setPlan("");
    setError("");
    setTxStatus("");
    setRoundId(Date.now().toString());
  }

  const verdictInfo = score
    ? VERDICT_LABEL[score.verdict] || { label: score.verdict.toUpperCase(), color: "#c8d5b8", icon: "?" }
    : null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            <div>
              <div className={styles.logoTitle}>SURVIVALMIND</div>
              <div className={styles.logoSub}>GENLAYER AI SURVIVAL JUDGMENT</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            {wallet ? (
              <div className={styles.walletBadge}>
                <span className={styles.walletDot} />
                <span className={styles.mono}>{shortAddr(wallet)}</span>
              </div>
            ) : (
              <button className={styles.btnConnect} onClick={handleConnect}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.gameCol}>

          {phase === "idle" && (
            <div className={styles.card + " animate-in"}>
              <div className={styles.cardLabel}>MISSION BRIEFING</div>
              <h1 className={styles.heroTitle}>
                Can You<br />Survive?
              </h1>
              <p className={styles.heroDesc}>
                GenLayer AI drops you into a real survival scenario. You submit your plan.
                Five LLM validators judge your resourcefulness, realism, and survival priority.
                Consensus determines if you live.
              </p>
              <div className={styles.pillRow}>
                <span className={styles.pill}>AI-Judged</span>
                <span className={styles.pill}>On-Chain</span>
                <span className={styles.pill}>Multi-Validator</span>
              </div>
              {!wallet ? (
                <button className={styles.btnPrimary} onClick={handleConnect}>
                  Connect Wallet to Play
                </button>
              ) : (
                <button className={styles.btnPrimary} onClick={handleGenerateScenario}>
                  Generate Scenario
                </button>
              )}
            </div>
          )}

          {phase === "generating" && (
            <div className={styles.card + " animate-in"}>
              <div className={styles.cardLabel}>GENERATING SCENARIO</div>
              <div className={styles.loadingBlock}>
                <div className={styles.loadingBar}>
                  <div className={styles.loadingFill} />
                </div>
                <p className={styles.txStatus + " mono"}>{txStatus}</p>
              </div>
            </div>
          )}

          {(phase === "submitting" || phase === "scoring") && scenario && (
            <div className="animate-in">
              <div className={styles.scenarioCard}>
                <div className={styles.scenarioHeader}>
                  <div>
                    <div className={styles.cardLabel}>ACTIVE SCENARIO</div>
                    <div className={styles.envTitle}>{scenario.environment}</div>
                  </div>
                  <div
                    className={styles.diffBadge}
                    style={{ color: DIFFICULTY_COLOR[scenario.difficulty] || "#c8d5b8" }}
                  >
                    {scenario.difficulty.toUpperCase()}
                  </div>
                </div>
                <p className={styles.scenarioDesc}>{scenario.description}</p>
                <div className={styles.threatBox}>
                  <span className={styles.threatLabel}>IMMEDIATE THREAT</span>
                  <span className={styles.threatText}>{scenario.immediate_threat}</span>
                </div>
                <div className={styles.resourcesSection}>
                  <div className={styles.resourcesLabel}>AVAILABLE RESOURCES</div>
                  <div className={styles.resourcesList}>
                    {(scenario.available_resources || []).map((r, i) => (
                      <div key={i} className={styles.resourceItem}>
                        <span className={styles.resourceBullet}>›</span>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>YOUR SURVIVAL PLAN</div>
                <p className={styles.planHint}>
                  Be specific. Use available resources. Address the immediate threat first.
                  The AI will score your realism, resourcefulness, and survival priority.
                </p>
                <textarea
                  className={styles.planInput}
                  rows={8}
                  placeholder="Describe step by step what you would do to survive..."
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  disabled={phase === "scoring"}
                />
                <div className={styles.planFooter}>
                  <span className={styles.charCount + " mono"}>{plan.length} chars</span>
                  {phase === "scoring" ? (
                    <div className={styles.scoringStatus}>
                      <div className={styles.scoringDot} />
                      <span className={styles.mono}>{txStatus}</span>
                    </div>
                  ) : (
                    <button
                      className={styles.btnPrimary}
                      onClick={handleSubmitPlan}
                      disabled={plan.trim().length < 20}
                    >
                      Submit to AI Judge
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {phase === "results" && score && scenario && verdictInfo && (
            <div className="animate-in">
              <div className={styles.resultsCard} style={{ borderColor: verdictInfo.color }}>
                <div className={styles.verdictHeader}>
                  <div className={styles.verdictIcon} style={{ color: verdictInfo.color }}>
                    {verdictInfo.icon}
                  </div>
                  <div>
                    <div className={styles.cardLabel}>AI VERDICT</div>
                    <div className={styles.verdictLabel} style={{ color: verdictInfo.color }}>
                      {verdictInfo.label}
                    </div>
                  </div>
                  <div className={styles.overallScore}>
                    <div className={styles.scoreNum}>{score.overall_score}</div>
                    <div className={styles.scoreMax}>/100</div>
                  </div>
                </div>
                <div className={styles.scoreBars}>
                  {[
                    { label: "Resourcefulness", value: score.resourcefulness },
                    { label: "Realism", value: score.realism },
                    { label: "Priority", value: score.priority },
                  ].map(({ label, value }) => (
                    <div key={label} className={styles.scoreBarRow}>
                      <div className={styles.scoreBarLabel}>{label}</div>
                      <div className={styles.scoreBarTrack}>
                        <div
                          className={styles.scoreBarFill}
                          style={{
                            width: `${value}%`,
                            backgroundColor: value >= 70 ? "#4caf50" : value >= 40 ? "#f5a623" : "#e05252",
                          }}
                        />
                      </div>
                      <div className={styles.scoreBarVal + " mono"}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.feedbackBox}>
                  <div className={styles.feedbackLabel}>AI FEEDBACK</div>
                  <p className={styles.feedbackText}>{score.feedback}</p>
                </div>
                <button className={styles.btnPrimary} onClick={handlePlayAgain}>
                  Play Again
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>!</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>SURVIVOR LEADERBOARD</div>
            {leaderboard.length === 0 ? (
              <p className={styles.emptyLb}>No survivors yet. Be the first.</p>
            ) : (
              <div className={styles.lbList}>
                {leaderboard.map((entry, i) => (
                  <div key={entry.player} className={styles.lbRow}>
                    <div className={styles.lbRank + " mono"}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className={styles.lbInfo}>
                      <div className={styles.lbAddr + " mono"}>{shortAddr(entry.player)}</div>
                      <div className={styles.lbMeta}>
                        {entry.total_rounds} rounds · {entry.survivor_count} survived
                      </div>
                    </div>
                    <div className={styles.lbScore + " mono"}>{entry.best_score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>HOW SCORING WORKS</div>
            <div className={styles.howList}>
              <div className={styles.howItem}>
                <span className={styles.howPct}>40%</span>
                <div>
                  <div className={styles.howTitle}>Survival Priority</div>
                  <div className={styles.howDesc}>Water, shelter, fire, food — in the right order for this environment.</div>
                </div>
              </div>
              <div className={styles.howItem}>
                <span className={styles.howPct}>35%</span>
                <div>
                  <div className={styles.howTitle}>Resourcefulness</div>
                  <div className={styles.howDesc}>Smart use of available resources. Creative improvisation.</div>
                </div>
              </div>
              <div className={styles.howItem}>
                <span className={styles.howPct}>25%</span>
                <div>
                  <div className={styles.howTitle}>Realism</div>
                  <div className={styles.howDesc}>Can a real person actually do this? Physical and logical feasibility.</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
