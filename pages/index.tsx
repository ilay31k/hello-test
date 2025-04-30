import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import * as Tone from 'tone';

interface Note {
  key: string; // e.g. 'c/4'
  duration: string; // e.g. 'q'
}

const instrumentSamples = {
  acoustic_grand_piano: {
    baseUrl: 'https://tonejs.github.io/audio/salamander/',
    urls: {
      C4: 'C4.mp3',
      D4: 'D4.mp3',
      E4: 'E4.mp3',
      F4: 'F4.mp3',
      G4: 'G4.mp3',
      A4: 'A4.mp3',
      B4: 'B4.mp3',
    },
  },
  baroque_violin: {
    baseUrl:
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/',
    urls: {
      C4: 'C4.mp3',
      D4: 'D4.mp3',
      E4: 'E4.mp3',
      F4: 'F4.mp3',
      G4: 'G4.mp3',
      A4: 'A4.mp3',
      B4: 'B4.mp3',
    },
  },
  lyre: {
    // Placeholder: use a harp sound for demo purposes
    baseUrl:
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts/FluidR3_GM/harp-mp3/',
    urls: {
      C4: 'C4.mp3',
      D4: 'D4.mp3',
      E4: 'E4.mp3',
      F4: 'F4.mp3',
      G4: 'G4.mp3',
      A4: 'A4.mp3',
      B4: 'B4.mp3',
    },
  },
  pan_flute: {
    baseUrl:
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts/FluidR3_GM/ocarina-mp3/',
    urls: {
      C4: 'C4.mp3',
      D4: 'D4.mp3',
      E4: 'E4.mp3',
      F4: 'F4.mp3',
      G4: 'G4.mp3',
      A4: 'A4.mp3',
      B4: 'B4.mp3',
    },
  },
};

export default function Home() {
  const divRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<Note[]>([
    { key: 'c/4', duration: 'q' },
    { key: 'd/4', duration: 'q' },
    { key: 'e/4', duration: 'q' },
    { key: 'f/4', duration: 'q' },
  ]);
  const [instrument, setInstrument] = useState<string>('acoustic_grand_piano');
  const synthRef = useRef<Tone.Sampler | null>(null);
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    divRef.current.innerHTML = '';

    const renderer = new Renderer(divRef.current, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, 480);
    stave.addClef('treble').setContext(context).draw();

    const vfNotes = notes.map((n) => {
      return new StaveNote({ keys: [n.key], duration: n.duration });
    });

    const voice = new Voice({ num_beats: notes.length, beat_value: 4 });
    voice.addTickables(vfNotes);

    new Formatter().joinVoices([voice]).format([voice], 400);

    voice.draw(context, stave);

    // Attach drag event handlers on note heads for vertical drag
    const svg = divRef.current.querySelector('svg');
    if (!svg) return;
    const noteHeads = svg.querySelectorAll('.vf-notehead');

    noteHeads.forEach((el, i) => {
      el.style.cursor = 'pointer';
      el.onmousedown = (e) => {
        e.preventDefault();
        setDraggedNoteIndex(i);
      };
    });
    svg.onmousemove = (e) => {
      if (draggedNoteIndex === null) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      const newPitch = yToPitch(cursorpt.y);
      setNotes((prev) => {
        const updated = [...prev];
        updated[draggedNoteIndex] = {
          ...updated[draggedNoteIndex],
          key: newPitch,
        };
        return updated;
      });
    };
    svg.onmouseup = () => {
      setDraggedNoteIndex(null);
    };
  }, [notes, draggedNoteIndex]);

  // Pitch mapping helper (treble clef, approx)
  const yToPitch = (y: number): string => {
    const lineSpacing = 10;
    const topY = 40; // stave y coordinate
    const steps = Math.round((y - topY) / (lineSpacing / 2));

    // MIDI note number for F5 top line = 77
    const midi = 77 - steps;
    const noteNames = [
      'c',
      'c#',
      'd',
      'd#',
      'e',
      'f',
      'f#',
      'g',
      'g#',
      'a',
      'a#',
      'b',
    ];
    const note = noteNames[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}/${octave}`;
  };

  // Add note on stave click
  const onStaveClick = (e: React.MouseEvent) => {
    if (!divRef.current) return;
    const svg = divRef.current.querySelector('svg');
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    if (cursorpt.x < 10 || cursorpt.x > 490) return;

    const pitch = yToPitch(cursorpt.y);
    setNotes((prev) => [...prev, { key: pitch, duration: 'q' }]);
  };

  // Setup/Reload instrument sampler
  useEffect(() => {
    synthRef.current?.dispose();

    const inst = instrumentSamples[instrument];
    if (!inst) return;

    const sampler = new Tone.Sampler({
      urls: inst.urls,
      baseUrl: inst.baseUrl,
      onload: () => console.log('Sampler loaded for', instrument),
    }).toDestination();

    synthRef.current = sampler;

    return () => {
      sampler.dispose();
    };
  }, [instrument]);

  // Play current notes sequentially
  const playNotes = async () => {
    await Tone.start();
    if (!synthRef.current) return;

    const now = Tone.now();
    notes.forEach((note, i) => {
      // Convert VexFlow key format c/4 -> C4
      const key = note.key.toUpperCase().replace('/', '');
      synthRef.current!.triggerAttackRelease(key, '8n', now + i * 0.5);
    });
  };

  // Export SVG as PDF helper
  const exportPdf = () => {
    if (!divRef.current) return;
    const svg = divRef.current.querySelector('svg');
    if (!svg) return;

    import('svg2pdf.js').then(({ default: svg2pdf }) => {
      import('pdf-lib').then(({ PDFDocument }) => {
        const svgString = new XMLSerializer().serializeToString(svg);
        const pdfDoc = PDFDocument.create();
        const page = pdfDoc.addPage([500, 200]);
        const { width, height } = page.getSize();

        svg2pdf(svg, page, {
          xOffset: 0,
          yOffset: 0,
          scale: 1,
        }).then(() => {
          pdfDoc.save().then((pdfBytes) => {
            const blob = new Blob([pdfBytes], {
              type: 'application/pdf',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sheet-music.pdf';
            a.click();
            URL.revokeObjectURL(url);
          });
        });
      });
    });
  };

  // Record MP3 of sequenced notes playback
  const exportMp3 = async () => {
    await Tone.start();
    if (!synthRef.current) return;
    const dest = Tone.context.createMediaStreamDestination();
    synthRef.current.connect(dest);

    const mediaRecorder = new MediaRecorder(dest.stream);
    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'composition.mp3';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    const now = Tone.now();
    notes.forEach((note, i) => {
      const key = note.key.toUpperCase().replace('/', '');
      synthRef.current!.triggerAttackRelease(key, '8n', now + i * 0.5);
    });
    setTimeout(() => {
      mediaRecorder.stop();
    }, notes.length * 500 + 500);
  };

  // MIDI export using Tone.js Midi utilities
  const exportMidi = () => {
    import('@tonejs/midi').then(({ Midi }) => {
      const midi = new (Midi as any)();
      const track = midi.addTrack();

      let time = 0;
      const quarterNoteDuration = 0.5;
      notes.forEach((note) => {
        // Remove slash: c/4 -> c4
        const key = note.key.replace('/', '').toLowerCase();
        track.addNote({
          name: key,
          time,
          duration: quarterNoteDuration,
          velocity: 0.8,
        });
        time += quarterNoteDuration;
      });

      const midiData = midi.toArray();
      const blob = new Blob([midiData], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'composition.mid';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Ancient & Modern Composer</h1>
      <p className="mb-2 text-gray-700">
        Click on the staff to add notes, drag notes vertically to change pitch.
      </p>

      <div
        ref={divRef}
        onClick={onStaveClick}
        className="border rounded bg-white shadow select-none cursor-crosshair"
      ></div>

      <div className="mt-4 flex items-center space-x-4">
        <button
          onClick={playNotes}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Play
        </button>
        <button
          onClick={exportPdf}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Export PDF
        </button>
        <button
          onClick={exportMp3}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Export MP3
        </button>
        <button
          onClick={exportMidi}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
        >
          Export MIDI
        </button>
      </div>

      <div className="mt-6 max-w-xs">
        <label className="block mb-1 font-semibold">Select Instrument</label>
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          className="w-full rounded border p-2"
        >
          <option value="acoustic_grand_piano">Piano (Modern)</option>
          <option value="baroque_violin">Baroque Violin (Ancient)</option>
          <option value="lyre">Lyre (Ancient, harp sound)</option>
          <option value="pan_flute">Pan Flute (Ancient)</option>
        </select>
      </div>
    </div>
  );
}
