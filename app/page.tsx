'use client';

import { useState } from 'react';
import SupabaseProvider from './components/SupabaseProvider'; // Import the provider
import Auth from './components/Auth'; // Import the auth component

// Le type pour structurer les résultats de l'optimisation
type OptimizationResult = {
  originalSize: number;
  jpegSize: number;
  webpSize: number;
  altText: string;
  jpegBase64: string;
  webpBase64: string;
};

// Le composant principal de notre application
function OptiPixelApp() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null); // Réinitialiser les résultats précédents
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
      }

      const data: OptimizationResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('An unknown error occurred');
        }
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-xl">
        {/* --- NOUVEAU : Bloc d'Authentification --- */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4 text-center">Account</h2>
            <Auth />
        </div>

        {/* --- Application OptiPixel existante --- */}
        <div className="bg-white p-8 rounded-xl shadow-md">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">OptiPixel 🚀</h1>
            <p className="text-center text-gray-500 mb-8">Optimize your images for the web in one click.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                    Choose an image:
                    </label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3-3a4 4 0 00-5.656 0L28 28M8 32l9-9a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                <span>Upload a file</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg" />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                        </div>
                    </div>
                    {selectedFile && <p className="text-sm text-center text-gray-500 mt-2">Selected file: {selectedFile.name}</p>}
                </div>
                <button
                    type="submit"
                    disabled={!selectedFile || isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Optimizing...' : 'Optimize!'}
                </button>
            </form>
        </div>

      {error && <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>}

      {result && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-md animate-fade-in-up">
          <h2 className="text-lg font-medium text-gray-900">Optimization Results ✨</h2>
          
          <div className="mt-4">
              <label htmlFor="alt-text" className="block text-sm font-medium text-gray-700">AI-generated Alt Text (SEO):</label>
              <textarea id="alt-text" rows={2} readOnly value={result.altText} className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"/>
          </div>

          <dl className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">Original size</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatBytes(result.originalSize)}</dd>
              </div>
              <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">JPEG (<span className="text-green-600 font-medium">-{(((result.originalSize - result.jpegSize) / result.originalSize) * 100).toFixed(0)}%</span>)</dt>
                  <a href={`data:image/jpeg;base64,${result.jpegBase64}`} download={`optipixel-${selectedFile?.name.split('.')[0]}.jpg`} className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Download</a>
              </div>
              <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">WebP (<span className="text-green-600 font-medium">-{(((result.originalSize - result.webpSize) / result.originalSize) * 100).toFixed(0)}%</span>)</dt>
                  <a href={`data:image/webp;base64,${result.webpBase64}`} download={`optipixel-${selectedFile?.name.split('.')[0]}.webp`} className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Download</a>
              </div>
          </dl>
        </div>
      )}
    </div>
  );
}

// Le composant exporté qui enveloppe l'application avec le Provider Supabase
export default function HomePage() {
  return (
    <SupabaseProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
        <OptiPixelApp />
      </main>
    </SupabaseProvider>
  );
}
