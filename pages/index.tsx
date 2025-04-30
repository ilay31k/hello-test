import React, { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import * as Tone from 'tone';

interface Note {
  key: string; // e.g., "c/4"
  duration: string; // "q" (quarter), "8" (eighth), etc.
}

const defaultNotes: Note[] = [
  { key: 'c/4', duration: 'q' },
  { key: 'd/4', duration: 'q' },
  { key: 'e/4', duration: 'q' },
  { key: 'f/4', duration: 'q' },
];

export default function Home() {
  const divRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<Note[]>(defaultNotes);
  const [instrument, setInstrument] = useState<string>('acoustic_grand_piano');
  const synthRef = useRef<Tone.Sampler | null>(null);

  // Render VexFlow sheet
  useEffect(() => {
    if (!divRef.current) return;

    divRef.current.innerHTML = '';

    const renderer = new Renderer(divRef.current, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, 480);
    stave.addClef('treble').setContext(context).draw();

    // Create vexflow notes from our state notes
    const vfNotes = notes.map(
      n => new StaveNote({ keys: [n.key], duration: n.duration }),
    );

    // Basic Formatter to arrange notes
    const voice = new Voice({ num_beats: notes.length, beat_value: 4 });
    voice.addTickables(vfNotes);

    new Formatter().joinVoices([voice]).format([voice], 400);

    voice.draw(context, stave);

  }, [notes]);

  // Initialize Tone.js sampler (using a piano SoundFont for demo)
  useEffect(() => {
    synthRef.current?.dispose();

    const sampler = new Tone.Sampler({
      urls: {
        C4: 'C4.mp3',
        D4: 'D4.mp3',
        E4: 'E4.mp3',
        F4: 'F4.mp3',
      },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      onload: () => {
        console.log('Sampler loaded');
      },
    }).toDestination();

    synthRef.current = sampler;

    return () => {
      sampler.dispose();
    };
  }, [instrument]);

  // Play notes sequentially
  const playNotes = async () => {
    await Tone.start();
    const now = Tone.now();
    notes.forEach((note, i) => {
      synthRef.current?.triggerAttackRelease(note.key.toUpperCase(), '8n', now + i * 0.5);
    });
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Ancient & Modern Composer</h1>

      <div ref={divRef} className="border rounded p-2 bg-white shadow"></div>

      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={playNotes}
      >
        Play
      </button>

      <div className="mt-4">
        <label className="block mb-1 font-semibold">Select Instrument</label>
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          className="border rounded p-2 w-full"
        >
          <option value="acoustic_grand_piano">Piano (Modern)</option>
          <option value="baroque_violin">Baroque Violin (Ancient)</option>
          <option value="lyre">Lyre (Ancient)</option>
          <option value="pan_flute">Pan Flute (Ancient)</option>
          {/* Add more instruments as needed */}
        </select>
      </div>

      {/* TODO: Add note editor drag-drop UI and historical mode selection */}

    </div>
  );
}