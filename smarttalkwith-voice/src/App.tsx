import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { useEffect, useState } from "react";
import { Brain, Plus, Search, Trash, Volume2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Word {
  id: string;
  myanmar: string;
  indonesian: string;
  type: string;
}

interface Sentence {
  id: string;
  myanmar: string;
  indonesian: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} else {
  console.error("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
}

export default function App() {
  const [newMyanmarWord, setNewMyanmarWord] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatedSentences, setGeneratedSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on initial render
  useEffect(() => {
    const storedWords = localStorage.getItem("words");
    if (storedWords) {
      setWords(JSON.parse(storedWords));
    }
    const storedSentences = localStorage.getItem("sentences");
    if (storedSentences) {
      setGeneratedSentences(JSON.parse(storedSentences));
    }
  }, []);

  // Save to localStorage whenever words or sentences change
  useEffect(() => {
    localStorage.setItem("words", JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    localStorage.setItem("sentences", JSON.stringify(generatedSentences));
  }, [generatedSentences]);

  const handleSaveWord = async () => {
    if (!newMyanmarWord.trim()) return;

    setLoading(true);
    setError(null);
    if (!ai) {
      setError("API Key is missing. Please configure GEMINI_API_KEY.");
      setLoading(false);
      return;
    }
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Translate the Myanmar word/phrase "${newMyanmarWord}" to Indonesian and detect its word type (Noun, Verb, Adjective, or Slang). Provide the output in JSON format with 'indonesianTranslation' and 'wordType' fields.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              indonesianTranslation: { type: Type.STRING },
              wordType: { type: Type.STRING },
            },
          },
        },
      });

      const jsonResponse = JSON.parse(response.text);
      const { indonesianTranslation, wordType } = jsonResponse;

      const newWord: Word = {
        id: Date.now().toString(),
        myanmar: newMyanmarWord,
        indonesian: indonesianTranslation,
        type: wordType,
      };
      setWords([newWord, ...words]);
      setNewMyanmarWord("");
    } catch (err) {
      console.error("Error saving word:", err);
      let errorMessage = "Failed to save word. Please try again.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err && typeof err.response === 'object' && err.response !== null && 'data' in err.response && typeof err.response.data === 'object' && err.response.data !== null && 'error' in err.response.data && typeof err.response.data.error === 'object' && err.response.data.error !== null && 'message' in err.response.data.error) {
        errorMessage = err.response.data.error.message as string;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWord = (id: string) => {
    setWords(words.filter((word) => word.id !== id));
  };

  const filteredWords = words.filter(
    (word) =>
      word.myanmar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      word.indonesian.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateSentence = async () => {
    if (!ai) {
      setError("API Key is missing. Please configure GEMINI_API_KEY.");
      setLoading(false);
      return;
    }
    if (words.length < 2) {
      setError("Please add at least two words to generate a sentence.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Pick a few random words (e.g., 2 to 4 words)
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      const selectedWords = shuffled.slice(0, Math.min(shuffled.length, 4));

      const myanmarSelectedWords = selectedWords.map((w) => w.myanmar).join(", ");
      const indonesianSelectedWords = selectedWords.map((w) => w.indonesian).join(", ");

      const prompt = `Strictly adhering only to the following words: "${indonesianSelectedWords}", construct a grammatically correct sentence or question or phrase or clause or slang of Indonesian language, without adding any other words. Output: Line 1: Myanmar Translation of the sentence. Line 2: Indonesian Sentence.`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const generatedText = response.text;
      const [myanmarSentence, indonesianSentence] = generatedText.split('\n').map(s => s.trim());

      const newSentence: Sentence = {
        id: Date.now().toString(),
        myanmar: myanmarSentence || "",
        indonesian: indonesianSentence || "",
      };
      setGeneratedSentences([newSentence, ...generatedSentences]);
    } catch (err) {
      console.error("Error generating sentence:", err);
      setError("Failed to generate sentence. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSentence = (id: string) => {
    setGeneratedSentences(generatedSentences.filter((sentence) => sentence.id !== id));
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Hard-coded to Indonesian
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech not supported in your browser.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
        <h1 className="text-4xl font-bold text-indigo-400 flex items-center gap-3">
          <Brain className="w-10 h-10" /> Smart Language Builder
        </h1>
      </header>

      {error && (
        <div className="bg-red-900 text-red-200 p-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* New Word Entry */}
      <section className="mb-10 p-6 bg-gray-900 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-indigo-300">New Word Entry</h2>
        <div className="flex gap-4">
          <input
            id="new-word-input"
            type="text"
            className="flex-grow p-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter Myanmar word..."
            value={newMyanmarWord}
            onChange={(e) => setNewMyanmarWord(e.target.value)}
            disabled={loading}
          />
          <button
            id="save-word-button"
            onClick={handleSaveWord}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors duration-200 disabled:opacity-50"
            disabled={loading}
          >
            <Plus className="w-5 h-5" /> Save
          </button>
        </div>
        {loading && <p className="text-indigo-400 mt-3">Processing...</p>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Word Bank */}
        <section className="p-6 bg-gray-900 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-indigo-300">Word Bank</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              id="search-word-input"
              type="text"
              className="w-full p-3 pl-10 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search words..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filteredWords.length === 0 ? (
              <p className="text-gray-500">No words found. Add some new words!</p>
            ) : (
              filteredWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-700"
                >
                  <div>
                    <p className="text-lg font-medium text-white">{word.myanmar}</p>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      {word.indonesian} <span className="italic text-gray-500">({word.type})</span>
                      <button
                        id={`speak-word-${word.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(word.indonesian);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 p-1 rounded-full transition-colors duration-200"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </p>
                  </div>
                  <button
                    id={`delete-word-${word.id}`}
                    onClick={() => handleDeleteWord(word.id)}
                    className="text-red-500 hover:text-red-600 p-2 rounded-full transition-colors duration-200"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* AI Sentence Builder */}
        <section className="p-6 bg-gray-900 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-indigo-300">AI Sentence Builder</h2>
          <button
            id="create-sentence-button"
            onClick={handleGenerateSentence}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors duration-200 disabled:opacity-50 mb-6"
            disabled={loading || words.length < 2}
          >
            <Brain className="w-5 h-5" /> Create Sentence
          </button>
          {loading && <p className="text-indigo-400 mb-3">Generating sentence...</p>}

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {generatedSentences.length === 0 ? (
              <p className="text-gray-500">No sentences generated yet.</p>
            ) : (
              generatedSentences.map((sentence) => (
                <div
                  key={sentence.id}
                  className="bg-gray-800 p-4 rounded-lg border border-gray-700"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center justify-between w-full">
                      <p className="text-lg font-medium text-white">Myanmar: {sentence.myanmar}</p>
                      <button
                        id={`speak-sentence-${sentence.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(sentence.indonesian);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 p-1 rounded-full transition-colors duration-200"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      id={`delete-sentence-${sentence.id}`}
                      onClick={() => handleDeleteSentence(sentence.id)}
                      className="text-red-500 hover:text-red-600 p-2 rounded-full transition-colors duration-200"
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-gray-300 text-base leading-relaxed">
                    <ReactMarkdown>{`Indonesian: ${sentence.indonesian}`}</ReactMarkdown>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <footer className="text-center text-gray-600 mt-12 pt-6 border-t border-gray-800">
        v1.0.1
      </footer>
    </div>
  );
}
