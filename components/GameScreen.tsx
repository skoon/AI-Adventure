import React, { useState, useRef, useEffect } from 'react';
import type { StorySegment, PlayerStats, Stat, Enemy } from '../types';

interface GameScreenProps {
  storyHistory: StorySegment[];
  inventory: string[];
  playerStats: PlayerStats;
  onSendAction: (action: string) => void;
  isLoading: boolean;
  onExportStory: () => void;
  onRestart: () => void;
  isInCombat: boolean;
  currentEnemy: Enemy | null;
}

const LoadingIndicator: React.FC = () => (
    <div className="flex items-center space-x-2 text-gray-400">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-300"></div>
        <span>The world is reacting...</span>
    </div>
);

const StoryLog: React.FC<{ storyHistory: StorySegment[] }> = ({ storyHistory }) => {
    const endOfLogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfLogRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [storyHistory]);

    const getTextColor = (type: StorySegment['type']) => {
        switch (type) {
            case 'action':
                return 'text-cyan-400';
            case 'narrative':
                return 'text-gray-300';
            case 'system':
                return 'text-yellow-400';
            default:
                return 'text-gray-300';
        }
    };
    
    return (
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
            {storyHistory.map((segment) => (
                <div key={segment.id} className="whitespace-pre-wrap">
                    {segment.type === 'action' && <span className="text-cyan-400 mr-2 font-bold">&gt;</span>}
                    
                    {segment.isImageLoading && (
                        <div className="my-4 aspect-video bg-gray-700/50 rounded-lg flex items-center justify-center animate-pulse">
                            <span className="text-gray-400">Conjuring a vision...</span>
                        </div>
                    )}
                    {segment.imageUrl && (
                        <img 
                            src={segment.imageUrl} 
                            alt="A scene from the adventure" 
                            className="my-4 rounded-lg shadow-lg w-full object-cover aspect-video"
                        />
                    )}
                    
                    <p className={`inline ${getTextColor(segment.type)}`}>{segment.text}</p>
                </div>
            ))}
            <div ref={endOfLogRef} />
        </div>
    );
};

const ActionButton: React.FC<{ onClick: () => void, children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        onClick={onClick}
        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-3 rounded-md transition-colors text-sm"
    >
        {children}
    </button>
);


const ActionInput: React.FC<{ onSendAction: (action: string) => void; isLoading: boolean; isInCombat: boolean; }> = ({ onSendAction, isLoading, isInCombat }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendAction(input.trim());
            setInput('');
        }
    };
    
    const handleActionClick = (action: string) => {
        if (!isLoading) {
            onSendAction(action);
        }
    };

    return (
        <div className="p-4 border-t border-gray-700 bg-gray-900">
            {isLoading && <div className="mb-2"><LoadingIndicator /></div>}
            <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isInCombat ? "Your combat action?" : "What do you do next?"}
                    disabled={isLoading}
                    className="flex-grow bg-gray-800 text-gray-200 border border-gray-600 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-cyan-600 text-white font-bold py-2 px-5 rounded-md hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                    Send
                </button>
            </form>
            {isInCombat && (
                <div className="mt-3 flex items-center justify-center space-x-3">
                    <ActionButton onClick={() => handleActionClick('attack')}>Attack</ActionButton>
                    <ActionButton onClick={() => handleActionClick('defend')}>Defend</ActionButton>
                    <ActionButton onClick={() => handleActionClick('flee')}>Flee</ActionButton>
                </div>
            )}
        </div>
    );
};

const StatBar: React.FC<{ label: string; stat: Stat; color: string }> = ({ label, stat, color }) => {
    const percentage = stat.max > 0 ? (stat.current / stat.max) * 100 : 0;
    return (
        <div className="mb-3">
            <div className="flex justify-between items-end text-sm mb-1">
                <span className="font-bold text-gray-200">{label}</span>
                <span className="font-mono text-gray-400">{stat.current} / {stat.max}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className={`${color} h-2.5 rounded-full`} style={{ width: `${percentage}%`, transition: 'width 0.5s ease-in-out' }}></div>
            </div>
        </div>
    );
};

const StatsDisplay: React.FC<{ stats: PlayerStats }> = ({ stats }) => (
    <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-bold text-cyan-400 border-b border-gray-600 pb-2 mb-4">Player Stats</h2>
        <StatBar label="Health" stat={stats.health} color="bg-red-500" />
        <StatBar label="Mana" stat={stats.mana} color="bg-blue-500" />
        <StatBar label="Stamina" stat={stats.stamina} color="bg-green-500" />
    </div>
);

const EnemyDisplay: React.FC<{ enemy: Enemy }> = ({ enemy }) => (
    <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-red-900/20">
        <h2 className="text-lg font-bold text-red-400 border-b border-red-800/50 pb-2 mb-4">Enemy</h2>
        <StatBar label={enemy.name} stat={enemy.health} color="bg-red-600" />
    </div>
);


const Inventory: React.FC<{ items: string[] }> = ({ items }) => (
    <div className="flex-grow p-4 overflow-y-auto">
        <h2 className="text-lg font-bold text-cyan-400 border-b border-gray-600 pb-2 mb-4">Inventory</h2>
        {items.length === 0 ? (
            <p className="text-gray-500 italic text-sm">Your pack is empty.</p>
        ) : (
            <ul className="space-y-2">
                {items.map((item, index) => (
                    <li key={index} className="text-gray-300 bg-gray-800/50 p-2 rounded-md text-sm">
                        {item}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const GameHeader: React.FC<{ onExportStory: () => void; onRestart: () => void; }> = ({ onExportStory, onRestart }) => {
    return (
        <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-900/80 flex justify-between items-center">
            <h1 className="text-xl font-bold text-cyan-400 tracking-wider">
                Gemini Adventure
            </h1>
            <div className="flex items-center space-x-3">
                 <button 
                    onClick={onExportStory} 
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-1 px-3 rounded-md transition-colors"
                >
                    Export Story
                </button>
                <button 
                    onClick={onRestart}
                    className="text-sm bg-red-800 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition-colors"
                    aria-label="Restart Game"
                >
                    Restart
                </button>
            </div>
        </div>
    );
};


export const GameScreen: React.FC<GameScreenProps> = ({ storyHistory, inventory, playerStats, onSendAction, isLoading, onExportStory, onRestart, isInCombat, currentEnemy }) => {
    return (
        <div className="flex flex-col md:flex-row h-screen max-w-7xl mx-auto bg-gray-800/50 shadow-2xl border-x border-gray-700">
            <div className="flex flex-col flex-grow">
                <GameHeader onExportStory={onExportStory} onRestart={onRestart} />
                <StoryLog storyHistory={storyHistory} />
                <ActionInput onSendAction={onSendAction} isLoading={isLoading} isInCombat={isInCombat} />
            </div>
            <div className="w-full md:w-72 flex-shrink-0 bg-gray-900/80 p-0 border-l border-gray-700 flex flex-col">
                {isInCombat && currentEnemy && <EnemyDisplay enemy={currentEnemy} />}
                <StatsDisplay stats={playerStats} />
                <Inventory items={inventory} />
            </div>
        </div>
    );
};