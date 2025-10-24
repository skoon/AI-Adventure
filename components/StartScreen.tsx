import React from 'react';
import { AdventureGenre } from '../types';

interface StartScreenProps {
  onStartGame: (genre: AdventureGenre) => void;
  isLoading: boolean;
  hasSaveGame: boolean;
  onLoadGame: () => void;
}

const GenreButton: React.FC<{ genre: AdventureGenre, onClick: (genre: AdventureGenre) => void, disabled: boolean }> = ({ genre, onClick, disabled }) => (
  <button
    onClick={() => onClick(genre)}
    disabled={disabled}
    className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
  >
    {genre}
  </button>
);

export const StartScreen: React.FC<StartScreenProps> = ({ onStartGame, isLoading, hasSaveGame, onLoadGame }) => {
  const genres = [
    AdventureGenre.FANTASY,
    AdventureGenre.SCIFI,
    AdventureGenre.MYSTERY,
    AdventureGenre.CYBERPUNK,
    AdventureGenre.STEAMPUNK,
    AdventureGenre.SPY,
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-center">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl md:text-7xl font-bold text-cyan-400 mb-4 tracking-wider">
          Gemini Adventure
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-12">
          An infinite story, shaped by your words. The adventure awaits.
        </p>
        <div className="bg-gray-800/50 p-6 md:p-8 rounded-xl shadow-2xl border border-gray-700">
          {hasSaveGame && !isLoading && (
             <>
              <button
                onClick={onLoadGame}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out mb-6"
              >
                Continue Last Adventure
              </button>
              <div className="relative my-4 flex items-center">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                <div className="flex-grow border-t border-gray-600"></div>
              </div>
            </>
          )}
          <h2 className="text-2xl font-bold text-white mb-6">
            {hasSaveGame ? 'Start a New World' : 'Choose Your World'}
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center space-x-3">
               <div className="w-5 h-5 bg-cyan-400 rounded-full animate-pulse"></div>
               <div className="w-5 h-5 bg-cyan-400 rounded-full animate-pulse delay-200"></div>
               <div className="w-5 h-5 bg-cyan-400 rounded-full animate-pulse delay-400"></div>
              <span className="text-gray-300">Summoning the storyteller...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {genres.map((genre) => (
                <GenreButton key={genre} genre={genre} onClick={onStartGame} disabled={isLoading} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};