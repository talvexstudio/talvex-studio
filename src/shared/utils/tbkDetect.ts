import JSZip from 'jszip';

export type TBKKind = 'blocks' | 'models' | 'unknown';

export type TBKInspection = {
  kind: TBKKind;
  hasContext: boolean;
};

export async function inspectTBKFile(file: File): Promise<TBKInspection> {
  const buffer = await file.arrayBuffer();
  try {
    const zip = await JSZip.loadAsync(buffer);
    const hasContext = Boolean(zip.file('context.json'));
    const modelFile = zip.file('model.json');
    if (!modelFile) {
      return { kind: 'unknown', hasContext };
    }
    const modelText = await modelFile.async('string');
    const parsed = safeParseJson(modelText);
    if (parsed?.kind === 'models') {
      return { kind: 'models', hasContext };
    }
    if (Array.isArray(parsed?.blocks)) {
      return { kind: 'blocks', hasContext };
    }
    return { kind: 'unknown', hasContext };
  } catch {
    const parsed = safeParseJson(new TextDecoder().decode(buffer));
    if (parsed?.kind === 'models') {
      return { kind: 'models', hasContext: false };
    }
    if (Array.isArray(parsed?.blocks)) {
      return { kind: 'blocks', hasContext: false };
    }
    return { kind: 'unknown', hasContext: false };
  }
}

function safeParseJson(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
