import { useState, useEffect } from "react";
import * as I from "lucide-react";

interface WritingHabitsProps {
  currentWordCount: number;
  close: () => void;
  notify: (msg: string) => void;
}

export function WritingHabits({ currentWordCount, close, notify }: WritingHabitsProps) {
  // Goal setting
  const [goal, setGoal] = useState<number>(() => {
    return Number(localStorage.getItem("titan.word_goal") || 500);
  });

  // Pomodoro timer state
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sprintsCompleted, setSprintsCompleted] = useState(() => {
    return Number(localStorage.getItem("titan.sprints_completed") || 0);
  });

  // Streak calculation
  const [streak, setStreak] = useState(() => {
    try {
      const lastDate = localStorage.getItem("titan.last_write_date");
      const currentStreak = Number(localStorage.getItem("titan.write_streak") || 1);
      const today = new Date().toDateString();
      if (lastDate === today) return currentStreak;
      return currentStreak;
    } catch {
      return 1;
    }
  });

  // Timer tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isRunning) {
      setIsRunning(false);
      setSprintsCompleted((c) => {
        const next = c + 1;
        localStorage.setItem("titan.sprints_completed", String(next));
        return next;
      });
      notify("🎉 Pomodoro sprint complete! Take a 5-minute break.");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft, notify]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(25 * 60);
  };

  const handleGoalChange = (newGoal: number) => {
    setGoal(newGoal);
    localStorage.setItem("titan.word_goal", String(newGoal));
    notify(`Daily goal set to ${newGoal} words`);
  };

  const progressPercent = Math.min(100, Math.round((currentWordCount / goal) * 100));

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="writing-habits-dialog" style={{ width: "100%", maxWidth: "560px", color: "#1f3328" }}>
      {/* Top Banner: Streak */}
      <div
        style={{
          background: "linear-gradient(135deg, #1b4938 0%, #296d53 100%)",
          color: "white",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#a5d9c2", fontWeight: 700 }}>
            Consistency Tracker
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "2px" }}>
            🔥 {streak} Day Writing Streak!
          </div>
          <div style={{ fontSize: "12px", color: "#d6ede2", marginTop: "2px" }}>
            Keep writing daily to maintain your momentum.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#4ade80" }}>{sprintsCompleted}</div>
          <div style={{ fontSize: "11px", color: "#c1e7d3" }}>Sprints Done</div>
        </div>
      </div>

      {/* Daily Goal Section */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#284435" }}>Daily Word Goal:</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#246c53" }}>
            {currentWordCount} / {goal} words ({progressPercent}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ height: "10px", background: "#e2ede6", borderRadius: "5px", overflow: "hidden", marginBottom: "10px" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: progressPercent >= 100 ? "#22c55e" : "#246c53",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Goal Preset Buttons */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[250, 500, 1000, 2000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleGoalChange(n)}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: "12px",
                fontWeight: 600,
                border: goal === n ? "2px solid #246c53" : "1px solid #ccd8cf",
                background: goal === n ? "#e0efe8" : "white",
                color: goal === n ? "#184534" : "#465f52",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {n} words
            </button>
          ))}
        </div>
      </div>

      {/* Pomodoro Focus Sprints */}
      <div
        style={{
          background: "#f4f8f5",
          border: "1px solid #d4ded8",
          borderRadius: "8px",
          padding: "16px",
          textAlign: "center",
          marginBottom: "18px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#486555", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Pomodoro Writing Sprint (25 Min)
        </div>

        <div style={{ fontSize: "40px", fontWeight: 800, fontFamily: "monospace", color: "#1b4434", margin: "8px 0" }}>
          {formatTimer(secondsLeft)}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={toggleTimer}
            style={{
              padding: "8px 24px",
              background: isRunning ? "#dc2626" : "#246c53",
              color: "white",
              fontWeight: 700,
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isRunning ? <I.Pause size={16} /> : <I.Play size={16} />}
            {isRunning ? "Pause Sprint" : "Start Sprint"}
          </button>

          <button
            type="button"
            onClick={resetTimer}
            style={{
              padding: "8px 16px",
              background: "white",
              border: "1px solid #bcc9c1",
              color: "#375043",
              fontWeight: 600,
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #d4ded8", paddingTop: "12px" }}>
        <button
          type="button"
          onClick={close}
          style={{
            padding: "7px 18px",
            background: "#246c53",
            color: "white",
            fontWeight: 600,
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

