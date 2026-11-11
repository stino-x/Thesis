import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadImage } from '@/utils/videoUtils';
import { drawImageScaled } from '@/utils/canvasUtils';
import { getFaceDetector, getFaceMesh } from '@/lib/mediapipe';
import { getDeepfakeDetector } from '@/lib/tensorflow';
import { detectFileWithUnivFD, isBackendAvailable } from '@/lib/api/univfdClient';

const COLUMNS = [
  'file', 'label', 'split', 'face',
  'vitDeepfakeExp', 'vitDeepfakeV2', 'deepfakeDetector', 'aiDetector', 
  'univfd_raw', 'univfd', 'grip', 'sbi', 'texture',
  'visual_ensemble', 'final_p', 'is_deepfake', 'error',
];

const BatchEvaluator = () => {
  const [real, setReal] = useState<File[]>([]);
  const [fake, setFake] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const cancelRef = useRef(false);

  const analyzeOne = async (file: File): Promise<Record<string, string | number>> => {
    const canvas = document.createElement('canvas');
    const img = await loadImage(file, 15000);
    drawImageScaled(canvas, img);

    const faceDetector = getFaceDetector();
    await faceDetector.waitForInitialization();
    await faceDetector.detect(canvas); // first call is discarded
    const faces = await faceDetector.detect(canvas);
    if (!faces[0]?.detected) return { face: 0 };

    const faceMesh = getFaceMesh();
    await faceMesh.waitForInitialization();
    await faceMesh.detect(canvas); // first call is discarded
    const mesh = await faceMesh.detect(canvas);
    const landmarks = mesh?.landmarks ?? undefined;

    let univfd = await detectFileWithUnivFD(file);
    if (!univfd) univfd = await detectFileWithUnivFD(file); // one retry for a cold backend

    const detector = getDeepfakeDetector();
    await detector.waitForInitialization();
    detector.setThreshold(0.5);
    const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

    const result = await detector.detectMultiModal({
      imageData,
      canvas,
      faceMesh: landmarks,
      faceBbox: faces[0].boundingBox ?? undefined,
      file,
      timestamp: performance.now(),
      univfd: univfd ?? undefined,
    });

    const s = result.scores;
    const finalP = result.isDeepfake ? 0.5 + result.confidence / 2 : 0.5 - result.confidence / 2;
    return {
      face: 1,
      vitDeepfakeExp: s.vitDeepfakeExp ?? '',
      vitDeepfakeV2: s.vitDeepfakeV2 ?? '',
      deepfakeDetector: s.deepfakeDetector ?? '',
      aiDetector: s.aiDetector ?? '',
      univfd_raw: univfd?.univfd_score != null ? (univfd.univfd_score * 100).toFixed(2) : '',
      univfd: univfd?.score != null ? (univfd.score * 100).toFixed(2) : '',
      grip: univfd?.grip_score != null ? (univfd.grip_score * 100).toFixed(2) : '',
      sbi: univfd?.sbi_score != null ? (univfd.sbi_score * 100).toFixed(2) : '',
      texture: s.texture ?? '',
      visual_ensemble: s.ensemble ?? '',
      final_p: finalP.toFixed(4),
      is_deepfake: result.isDeepfake ? 1 : 0,
    };
  };

  const run = async () => {
    cancelRef.current = false;
    setRunning(true);
    setRows([]);
    await isBackendAvailable();

    // alternate real and fake so any order effect hits both classes equally
    const items: { f: File; label: string; split: string }[] = [];
    for (let i = 0; i < Math.max(real.length, fake.length); i++) {
      if (real[i]) items.push({ f: real[i], label: 'real', split: i % 10 < 3 ? 'test' : 'tune' });
      if (fake[i]) items.push({ f: fake[i], label: 'fake', split: i % 10 < 3 ? 'test' : 'tune' });
    }

    const out: Record<string, string | number>[] = [];
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      const { f, label, split } = items[i];
      setProgress(`${i + 1} / ${items.length}: ${f.name}`);
      let row: Record<string, string | number>;
      try {
        row = await analyzeOne(f);
      } catch (e) {
        row = { error: e instanceof Error ? e.message : String(e) };
      }
      out.push({ file: f.name, label, split, ...row });
      setRows([...out]);
    }
    setProgress(cancelRef.current ? 'Cancelled' : `Done: ${out.length} images`);
    setRunning(false);
  };

  const download = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      COLUMNS.join(','),
      ...rows.map(r => COLUMNS.map(c => esc(r[c])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eval_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <h3 className="font-semibold">Batch evaluator (temporary)</h3>
      <div className="flex gap-6 flex-wrap text-sm">
        <label>
          Real images ({real.length}){' '}
          <input type="file" accept="image/*" multiple onChange={e => setReal(Array.from(e.target.files ?? []))} />
        </label>
        <label>
          Fake images ({fake.length}){' '}
          <input type="file" accept="image/*" multiple onChange={e => setFake(Array.from(e.target.files ?? []))} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button onClick={run} disabled={running || (real.length + fake.length === 0)}>Run batch</Button>
        <Button onClick={() => { cancelRef.current = true; }} variant="outline" disabled={!running}>Cancel</Button>
        <Button onClick={download} variant="outline" disabled={rows.length === 0}>Download CSV</Button>
      </div>
      <p className="text-sm text-muted-foreground">{progress}</p>
    </div>
  );
};

export default BatchEvaluator;
