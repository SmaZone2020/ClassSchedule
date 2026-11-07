import type { DailyWord } from "./useDailyWord";
import WeatherCard from "./WeatherCard";
import { Calendar } from "./icons";

interface WeekFinishedProps {
  weather: import("./weatherInfo").WeatherInfo | null;
  now: Date;
  word: DailyWord | null;
  wordLoading: boolean;
  onNextWord: () => void;
  onReveal: () => void;
}

/**
 * The "all classes are done" screen: today's weather, one line of classical
 * poetry in place of the status label, and the button that reveals the
 * finished timetable.
 */
export default function WeekFinished({
  weather,
  now,
  word,
  wordLoading,
  onNextWord,
  onReveal
}: WeekFinishedProps) {
  return (
    <div className="week-break">
      <WeatherCard weather={weather} now={now} />

      <div className="week-break-footer">
        <button
          className="week-word"
          onClick={onNextWord}
          disabled={wordLoading}
          title="换一句"
          aria-label="换一句"
        >
          <span className="week-word-text">
            {word ? word.content : "正在取一句诗…"}
          </span>
          {word && (word.title || word.author) ? (
            <span className="week-word-from">
              {[word.author, word.title].filter(Boolean).join("《")}
              {word.title ? "》" : ""}
            </span>
          ) : null}
        </button>

        <button
          className="week-nav week-nav-lg"
          onClick={onReveal}
          aria-label="显示课程"
          title="显示课程"
        >
          <Calendar width={17} height={17} />
        </button>
      </div>
    </div>
  );
}
