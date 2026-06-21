import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, FlaskConical, ImagePlus, Loader2, Upload } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

type CurvePoint = { shift: number; R: number; G: number; B: number };
type HeatCell = { x: number; y: number; hue: number; confidence: number };
type CfaMode = "AUTO" | "GXXG" | "XGGX";
type Language = "ko" | "en";

type AnalysisResult = {
  width: number;
  height: number;
  input_kind?: "rgb" | "raw";
  developed_preview?: string;
  raw_camera_cfa_conflict?: boolean;
  raw_metadata?: {
    backend: string;
    bayer_pattern: string | null;
    green_mode: "GXXG" | "XGGX" | null;
    raw_size: [number, number];
    rgb_size: [number, number];
  } | null;
  options: {
    ds: number;
    block_size: number;
    cfa_green_mode: CfaMode;
    resolved_cfa_green_mode: "GXXG" | "XGGX";
    cfa_resolution_source: "camera_spec" | "image_estimate" | "manual" | "raw_pattern";
  };
  camera: {
    make: string;
    model: string;
    software: string;
    bayer_pattern: string | null;
    green_mode: "GXXG" | "XGGX" | null;
    source: string;
    source_url: string | null;
    lookup_status: "known" | "unknown";
  };
  cfa_prediction: {
    mode: "GXXG" | "XGGX";
    confidence: number;
    reliability: "low" | "medium" | "high";
    source_channel: "R" | "G" | "B";
  };
  estimate: { estimated_hue: number; hm: number; criterion: string };
  curves: CurvePoint[];
  heatmap: HeatCell[][];
};

type SampleResult = { hue_shift: number; image: string; annotated: string };

const API_BASE = `http://${window.location.hostname}:8000`;
const ACCEPTED_FILES = [
  "image/png",
  "image/jpeg",
  ".nef",
  ".cr2",
  ".cr3",
  ".arw",
  ".dng",
  ".orf",
  ".rw2",
  ".raf",
  ".pef",
  ".sr2",
].join(",");

const RAW_EXTENSIONS = [".nef", ".cr2", ".cr3", ".arw", ".dng", ".orf", ".rw2", ".raf", ".pef", ".sr2"];

const TEXT = {
  ko: {
    subtitle: "색상 변조 추정 재현 도구",
    filePick: "PNG, JPEG 또는 RAW 이미지 선택",
    rawPending: "RAW 파일은 분석 후 rawpy 개발 미리보기가 표시됩니다.",
    hueStep: "Hue step Ds",
    blockSize: "Block size",
    cfaMode: "CFA green mode",
    analyze: "분석",
    sample: "샘플 로드",
    analyzeError: "분석 중 오류가 발생했습니다.",
    sampleError: "샘플 생성 중 오류가 발생했습니다.",
    estimatedHue: "추정 hue shift",
    resolvedMode: "CFA mode",
    inputType: "Input type",
    bayerPattern: "Bayer pattern",
    rawBayer: "RAW Bayer",
    rawMode: "RAW mode",
    modeSource: "Mode source",
    confidence: "CFA confidence",
    reliability: "Reliability",
    criterion: "Criterion",
    imageSize: "Image",
    camera: "Camera",
    sampleTruth: "Sample truth",
    conflict: "CFA conflict",
    inputImage: "입력 이미지",
    heatmap: "Block heatmap",
    curve: "AIVC ratio curves",
    emptyImage: "이미지를 선택하거나 샘플을 로드하세요.",
    emptyHeatmap: "분석 후 block별 hue 추정값이 색으로 표시됩니다.",
    emptyCurve: "AIVC counting ratio 그래프가 여기에 표시됩니다.",
    unknown: "unknown",
    auto: "Auto",
    source_camera_spec: "camera spec",
    source_image_estimate: "image estimate",
    source_manual: "manual",
    source_raw_pattern: "raw pattern",
    rel_high: "high",
    rel_medium: "medium",
    rel_low: "low",
    yes: "yes",
    no: "no",
  },
  en: {
    subtitle: "Color modification estimation lab",
    filePick: "Choose a PNG, JPEG, or RAW image",
    rawPending: "RAW files show a rawpy-developed preview after analysis.",
    hueStep: "Hue step Ds",
    blockSize: "Block size",
    cfaMode: "CFA green mode",
    analyze: "Analyze",
    sample: "Load sample",
    analyzeError: "Analysis failed.",
    sampleError: "Sample generation failed.",
    estimatedHue: "Estimated hue shift",
    resolvedMode: "CFA mode",
    inputType: "Input type",
    bayerPattern: "Bayer pattern",
    rawBayer: "RAW Bayer",
    rawMode: "RAW mode",
    modeSource: "Mode source",
    confidence: "CFA confidence",
    reliability: "Reliability",
    criterion: "Criterion",
    imageSize: "Image",
    camera: "Camera",
    sampleTruth: "Sample truth",
    conflict: "CFA conflict",
    inputImage: "Input image",
    heatmap: "Block heatmap",
    curve: "AIVC ratio curves",
    emptyImage: "Choose an image or load the synthetic sample.",
    emptyHeatmap: "After analysis, block-level hue estimates are shown as color.",
    emptyCurve: "AIVC counting ratio curves will appear here.",
    unknown: "unknown",
    auto: "Auto",
    source_camera_spec: "camera spec",
    source_image_estimate: "image estimate",
    source_manual: "manual",
    source_raw_pattern: "raw pattern",
    rel_high: "high",
    rel_medium: "medium",
    rel_low: "low",
    yes: "yes",
    no: "no",
  },
} satisfies Record<Language, Record<string, string>>;

function isRawFile(file: File) {
  const name = file.name.toLowerCase();
  return RAW_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, payload] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(payload);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
  return new File([array], filename, { type: mime });
}

function hueToColor(hue: number, confidence: number) {
  const alpha = Math.min(0.82, Math.max(0.18, confidence / 2.8));
  return `hsla(${hue}, 82%, 50%, ${alpha})`;
}

function cameraLabel(result: AnalysisResult | null, unknown: string) {
  if (!result) return "--";
  const make = result.camera.make || "";
  const model = result.camera.model || "";
  return `${make} ${model}`.trim() || unknown;
}

function sourceLabel(result: AnalysisResult, labels: Record<string, string>) {
  return labels[`source_${result.options.cfa_resolution_source}`] ?? result.options.cfa_resolution_source;
}

function reliabilityLabel(result: AnalysisResult, labels: Record<string, string>) {
  return labels[`rel_${result.cfa_prediction.reliability}`] ?? result.cfa_prediction.reliability;
}

function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ds, setDs] = useState(5);
  const [blockSize, setBlockSize] = useState(32);
  const [mode, setMode] = useState<CfaMode>("AUTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = TEXT[language];

  const displayPreview = result?.developed_preview || preview;
  const heatmapCells = useMemo(() => result?.heatmap.flat() ?? [], [result]);
  const maxConfidence = useMemo(
    () => heatmapCells.reduce((max, cell) => Math.max(max, cell.confidence), 0),
    [heatmapCells],
  );

  async function analyze(nextFile = file) {
    if (!nextFile) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", nextFile);
      form.append("ds", String(ds));
      form.append("block_size", String(blockSize));
      form.append("cfa_green_mode", mode);
      const response = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      setResult((await response.json()) as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.analyzeError);
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("hue_shift", "120");
      const response = await fetch(`${API_BASE}/api/generate-sample`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      const nextSample = (await response.json()) as SampleResult;
      const nextFile = dataUrlToFile(nextSample.image, "synthetic-cfa-sample.png");
      setSample(nextSample);
      setFile(nextFile);
      setPreview(nextSample.image);
      await analyze(nextFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.sampleError);
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setSample(null);
    setError("");
    if (!nextFile) {
      setPreview("");
    } else if (isRawFile(nextFile)) {
      setPreview("");
    } else {
      setPreview(URL.createObjectURL(nextFile));
    }
  }

  return (
    <main className="shell">
      <section className="workspace">
        <aside className="panel controls">
          <div className="brand">
            <div className="brand-mark">
              <FlaskConical size={22} />
            </div>
            <div>
              <h1>CFA Hue Lab</h1>
              <p>{text.subtitle}</p>
            </div>
          </div>

          <div className="language-toggle" role="group" aria-label="Language">
            <button type="button" className={language === "ko" ? "active" : ""} onClick={() => setLanguage("ko")}>
              한국어
            </button>
            <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
              English
            </button>
          </div>

          <label className="file-drop">
            <ImagePlus size={26} />
            <span>{file ? file.name : text.filePick}</span>
            {file && isRawFile(file) && !result?.developed_preview && <small>{text.rawPending}</small>}
            <input type="file" accept={ACCEPTED_FILES} onChange={onFileChange} />
          </label>

          <div className="control-grid">
            <label>
              <span>{text.hueStep}</span>
              <input type="range" min="1" max="20" value={ds} onChange={(event) => setDs(Number(event.target.value))} />
              <strong>{ds} deg</strong>
            </label>
            <label>
              <span>{text.blockSize}</span>
              <select value={blockSize} onChange={(event) => setBlockSize(Number(event.target.value))}>
                <option value={32}>32 x 32</option>
                <option value={64}>64 x 64</option>
                <option value={128}>128 x 128</option>
              </select>
            </label>
            <label>
              <span>{text.cfaMode}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as CfaMode)}>
                <option value="AUTO">{text.auto}</option>
                <option value="GXXG">GXXG</option>
                <option value="XGGX">XGGX</option>
              </select>
            </label>
          </div>

          <div className="actions">
            <button onClick={() => analyze()} disabled={!file || busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <Activity size={18} />}
              {text.analyze}
            </button>
            <button className="secondary" onClick={loadSample} disabled={busy}>
              <Upload size={18} />
              {text.sample}
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </aside>

        <section className="main-area">
          <div className="result-strip">
            <div>
              <span>{text.estimatedHue}</span>
              <strong>{result ? `${result.estimate.estimated_hue.toFixed(1)} deg` : "--"}</strong>
            </div>
            <div>
              <span>{text.resolvedMode}</span>
              <strong>{result ? result.options.resolved_cfa_green_mode : "--"}</strong>
            </div>
            <div>
              <span>{text.inputType}</span>
              <strong>{result ? result.input_kind ?? "rgb" : "--"}</strong>
            </div>
            <div>
              <span>{text.bayerPattern}</span>
              <strong>{result ? result.camera.bayer_pattern ?? text.unknown : "--"}</strong>
            </div>
            <div>
              <span>{text.rawBayer}</span>
              <strong>{result ? result.raw_metadata?.bayer_pattern ?? "n/a" : "--"}</strong>
            </div>
            <div>
              <span>{text.rawMode}</span>
              <strong>{result ? result.raw_metadata?.green_mode ?? "n/a" : "--"}</strong>
            </div>
            <div>
              <span>{text.modeSource}</span>
              <strong>{result ? sourceLabel(result, text) : "--"}</strong>
            </div>
            <div>
              <span>{text.conflict}</span>
              <strong>{result ? (result.raw_camera_cfa_conflict ? text.yes : text.no) : "--"}</strong>
            </div>
            <div>
              <span>{text.confidence}</span>
              <strong>{result ? `${(result.cfa_prediction.confidence * 100).toFixed(1)}%` : "--"}</strong>
            </div>
            <div>
              <span>{text.reliability}</span>
              <strong>{result ? reliabilityLabel(result, text) : "--"}</strong>
            </div>
            <div>
              <span>{text.criterion}</span>
              <strong>{result ? result.estimate.criterion : "--"}</strong>
            </div>
            <div>
              <span>{text.imageSize}</span>
              <strong>{result ? `${result.width} x ${result.height}` : "--"}</strong>
            </div>
            <div>
              <span>{text.camera}</span>
              <strong>{cameraLabel(result, text.unknown)}</strong>
            </div>
            <div>
              <span>{text.sampleTruth}</span>
              <strong>{sample ? `${sample.hue_shift} deg` : "--"}</strong>
            </div>
          </div>

          <div className="visual-grid">
            <section className="panel image-stage">
              <header>
                <h2>{text.inputImage}</h2>
              </header>
              {displayPreview ? (
                <img src={displayPreview} alt="Uploaded CFA analysis target" />
              ) : (
                <div className="empty">{text.emptyImage}</div>
              )}
            </section>

            <section className="panel image-stage">
              <header>
                <h2>{text.heatmap}</h2>
              </header>
              <div className="heatmap-wrap">
                {displayPreview && <img src={displayPreview} alt="Heatmap base" />}
                {result && (
                  <div className="heatmap-layer">
                    {heatmapCells.map((cell) => (
                      <div
                        className="heat-cell"
                        key={`${cell.x}-${cell.y}`}
                        style={{
                          left: `${(cell.x / result.width) * 100}%`,
                          top: `${(cell.y / result.height) * 100}%`,
                          width: `${(result.options.block_size / result.width) * 100}%`,
                          height: `${(result.options.block_size / result.height) * 100}%`,
                          background: hueToColor(cell.hue, cell.confidence / Math.max(maxConfidence, 0.001)),
                        }}
                        title={`hue ${cell.hue.toFixed(1)} deg, confidence ${cell.confidence.toFixed(2)}`}
                      />
                    ))}
                  </div>
                )}
                {!displayPreview && <div className="empty">{text.emptyHeatmap}</div>}
              </div>
            </section>
          </div>

          <section className="panel chart-panel">
            <header>
              <h2>{text.curve}</h2>
            </header>
            <div className="chart-box">
              {result ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.curves}>
                    <CartesianGrid stroke="#d8dde6" />
                    <XAxis dataKey="shift" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="R" stroke="#d44a4a" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="G" stroke="#3c9b62" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="B" stroke="#3d72c4" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">{text.emptyCurve}</div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
