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
type AnalysisResult = {
  width: number;
  height: number;
  options: {
    ds: number;
    block_size: number;
    cfa_green_mode: CfaMode;
    resolved_cfa_green_mode: "GXXG" | "XGGX";
    cfa_resolution_source: "camera_spec" | "image_estimate" | "manual";
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

function reliabilityLabel(reliability?: string) {
  if (reliability === "high") return "high";
  if (reliability === "medium") return "medium";
  if (reliability === "low") return "low";
  return "--";
}

function cameraLabel(result: AnalysisResult | null) {
  if (!result) return "--";
  const make = result.camera.make || "Unknown";
  const model = result.camera.model || "Unknown";
  return `${make} ${model}`.trim();
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ds, setDs] = useState(5);
  const [blockSize, setBlockSize] = useState(32);
  const [mode, setMode] = useState<CfaMode>("AUTO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
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
      setError(err instanceof Error ? err.message : "샘플 생성 중 오류가 발생했습니다.");
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
    if (nextFile) setPreview(URL.createObjectURL(nextFile));
  }

  return (
    <main className="shell">
      <section className="workspace">
        <aside className="panel controls">
          <div className="brand">
            <div className="brand-mark"><FlaskConical size={22} /></div>
            <div>
              <h1>CFA Hue Lab</h1>
              <p>색상 변조 추정 재현 도구</p>
            </div>
          </div>

          <label className="file-drop">
            <ImagePlus size={26} />
            <span>{file ? file.name : "PNG 또는 JPEG 이미지 선택"}</span>
            <input type="file" accept="image/png,image/jpeg" onChange={onFileChange} />
          </label>

          <div className="control-grid">
            <label>
              <span>Hue step Ds</span>
              <input type="range" min="1" max="20" value={ds} onChange={(event) => setDs(Number(event.target.value))} />
              <strong>{ds} deg</strong>
            </label>
            <label>
              <span>Block size</span>
              <select value={blockSize} onChange={(event) => setBlockSize(Number(event.target.value))}>
                <option value={32}>32 x 32</option>
                <option value={64}>64 x 64</option>
                <option value={128}>128 x 128</option>
              </select>
            </label>
            <label>
              <span>CFA green mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as CfaMode)}>
                <option value="AUTO">Auto</option>
                <option value="GXXG">GXXG</option>
                <option value="XGGX">XGGX</option>
              </select>
            </label>
          </div>

          <div className="actions">
            <button onClick={() => analyze()} disabled={!file || busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <Activity size={18} />}
              분석
            </button>
            <button className="secondary" onClick={loadSample} disabled={busy}>
              <Upload size={18} />
              샘플 로드
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </aside>

        <section className="main-area">
          <div className="result-strip">
            <div>
              <span>Estimated hue shift</span>
              <strong>{result ? `${result.estimate.estimated_hue.toFixed(1)} deg` : "--"}</strong>
            </div>
            <div>
              <span>CFA mode</span>
              <strong>{result ? result.options.resolved_cfa_green_mode : "--"}</strong>
            </div>
            <div>
              <span>Bayer pattern</span>
              <strong>{result ? result.camera.bayer_pattern ?? "unknown" : "--"}</strong>
            </div>
            <div>
              <span>Mode source</span>
              <strong>{result ? result.options.cfa_resolution_source : "--"}</strong>
            </div>
            <div>
              <span>CFA confidence</span>
              <strong>{result ? `${(result.cfa_prediction.confidence * 100).toFixed(1)}%` : "--"}</strong>
            </div>
            <div>
              <span>Reliability</span>
              <strong>{result ? reliabilityLabel(result.cfa_prediction.reliability) : "--"}</strong>
            </div>
            <div>
              <span>Criterion</span>
              <strong>{result ? result.estimate.criterion : "--"}</strong>
            </div>
            <div>
              <span>Image</span>
              <strong>{result ? `${result.width} x ${result.height}` : "--"}</strong>
            </div>
            <div>
              <span>Camera</span>
              <strong>{cameraLabel(result)}</strong>
            </div>
            <div>
              <span>Sample truth</span>
              <strong>{sample ? `${sample.hue_shift} deg` : "--"}</strong>
            </div>
          </div>

          <div className="visual-grid">
            <section className="panel image-stage">
              <header>
                <h2>입력 이미지</h2>
              </header>
              {preview ? <img src={preview} alt="Uploaded CFA analysis target" /> : <div className="empty">이미지를 선택하거나 샘플을 로드하세요.</div>}
            </section>

            <section className="panel image-stage">
              <header>
                <h2>Block heatmap</h2>
              </header>
              <div className="heatmap-wrap">
                {preview && <img src={preview} alt="Heatmap base" />}
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
                {!preview && <div className="empty">분석 후 block별 hue 추정값이 색으로 표시됩니다.</div>}
              </div>
            </section>
          </div>

          <section className="panel chart-panel">
            <header>
              <h2>AIVC ratio curves</h2>
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
                <div className="empty">AIVC counting ratio 그래프가 여기에 표시됩니다.</div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
