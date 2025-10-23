import React, { useState, useCallback, useEffect } from 'react';
import type { StorySegment, AdventureGenre, ChatSession, SavedGame, PlayerStats } from './types';
import { GameState } from './types';
import { StartScreen } from './components/StartScreen';
import { GameScreen } from './components/GameScreen';
import { startAdventure, continueAdventure, resumeAdventure, generateImage } from './services/geminiService';

const SAVE_KEY = 'geminiAdventureSave';

const parseGeminiResponse = (responseText: string): { narrative: string; itemsToAdd: string[]; itemsToRemove: string[]; imagePrompt: string | null; statUpdates: Record<string, number> } => {
    const narrativeLines = [];
    const itemsToAdd: string[] = [];
    const itemsToRemove: string[] = [];
    let imagePrompt: string | null = null;
    const statUpdates: Record<string, number> = {};
    const lines = responseText.split('\n');

    for (const line of lines) {
        const addMatch = line.match(/\[INVENTORY_ADD:\s*(.+)\]/);
        if (addMatch?.[1]) {
            itemsToAdd.push(addMatch[1].trim());
            continue;
        }
        const removeMatch = line.match(/\[INVENTORY_REMOVE:\s*(.+)\]/);
        if (removeMatch?.[1]) {
            itemsToRemove.push(removeMatch[1].trim());
            continue;
        }
        const imagePromptMatch = line.match(/\[IMAGE_PROMPT:\s*(.+)\]/);
        if (imagePromptMatch?.[1]) {
            imagePrompt = imagePromptMatch[1].trim();
            continue;
        }
        const statUpdateMatch = line.match(/\[STAT_UPDATE:\s*(.+)\]/);
        if (statUpdateMatch?.[1]) {
            const updates = statUpdateMatch[1].split(',');
            updates.forEach(update => {
                const [stat, value] = update.split('=').map(s => s.trim());
                const numValue = parseInt(value, 10);
                if (stat && !isNaN(numValue)) {
                    statUpdates[stat] = numValue;
                }
            });
            continue;
        }
        narrativeLines.push(line);
    }

    return {
        narrative: narrativeLines.join('\n').trim(),
        itemsToAdd,
        itemsToRemove,
        imagePrompt,
        statUpdates,
    };
};


const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(GameState.START_SCREEN);
    const [storyHistory, setStoryHistory] = useState<StorySegment[]>([]);
    const [inventory, setInventory] = useState<string[]>([]);
    const [playerStats, setPlayerStats] = useState<PlayerStats>({
        health: { current: 100, max: 100 },
        mana: { current: 50, max: 50 },
        stamina: { current: 80, max: 80 },
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [chatSession, setChatSession] = useState<ChatSession | null>(null);
    const [hasSaveGame, setHasSaveGame] = useState<boolean>(false);
    const [isSaveDisabledByQuota, setIsSaveDisabledByQuota] = useState<boolean>(false);

    useEffect(() => {
        try {
            const savedGame = localStorage.getItem(SAVE_KEY);
            setHasSaveGame(!!savedGame);
        } catch (error) {
            console.error("Could not access localStorage:", error);
            setHasSaveGame(false);
        }
    }, []);

    // Auto-save game progress
    useEffect(() => {
        if (gameState !== GameState.PLAYING || !chatSession || storyHistory.length === 0 || isSaveDisabledByQuota) {
            return;
        }

        const saveGame = async () => {
            try {
                const chatHistory = await chatSession.getHistory();
                if (chatHistory.length > 0) {
                    // Create a version of storyHistory without image data for saving
                    const storyHistoryForSave = storyHistory.map(segment => {
                        const { imageUrl, isImageLoading, ...rest } = segment;
                        return rest;
                    });
                    const saveData: SavedGame = { storyHistory: storyHistoryForSave, chatHistory, inventory, playerStats };
                    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
                    setHasSaveGame(true);
                }
            } catch (e) {
                console.error("Auto-save failed:", e);
                if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                    console.warn("LocalStorage quota exceeded. Disabling auto-save.");
                    setIsSaveDisabledByQuota(true);
                    const errorSegment: StorySegment = {
                        id: storyHistory.length,
                        type: 'system',
                        text: `[System Warning: The adventure has grown too large for auto-saving. You can continue playing, but further progress won't be saved. Consider exporting your story.]`,
                    };
                    setStoryHistory(prev => [...prev, errorSegment]);
                }
            }
        };
        
        // Debounce saving to prevent rapid writes
        const timer = setTimeout(saveGame, 500);
        return () => clearTimeout(timer);

    }, [storyHistory, inventory, gameState, chatSession, isSaveDisabledByQuota, playerStats]);


    const handleStartGame = useCallback(async (genre: AdventureGenre) => {
        setIsLoading(true);
        setErrorMessage(null);
        setStoryHistory([]);
        setInventory([]);
        setPlayerStats({
            health: { current: 100, max: 100 },
            mana: { current: 50, max: 50 },
            stamina: { current: 80, max: 80 },
        });
        setIsSaveDisabledByQuota(false);

        try {
            localStorage.removeItem(SAVE_KEY);
            setHasSaveGame(false);

            const { session, opening } = await startAdventure(genre);
            setChatSession(session);

            const { narrative, imagePrompt } = parseGeminiResponse(opening);

            const openingSegment: StorySegment = {
                 id: 0, 
                 type: 'narrative', 
                 text: narrative,
                 isImageLoading: !!imagePrompt,
            };
            setStoryHistory([openingSegment]);
            
            if (imagePrompt) {
                 (async () => {
                    try {
                        const base64Data = await generateImage(imagePrompt);
                        const imageUrl = `data:image/png;base64,${base64Data}`;
                         setStoryHistory(prev => prev.map(seg => 
                            seg.id === openingSegment.id 
                                ? { ...seg, imageUrl, isImageLoading: false } 
                                : seg
                        ));
                    } catch (e) {
                         console.error("Image generation failed:", e);
                         setStoryHistory(prev => prev.map(seg => 
                            seg.id === openingSegment.id 
                                ? { ...seg, isImageLoading: false }
                                : seg
                        ));
                    }
                })();
            }

            setGameState(GameState.PLAYING);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setErrorMessage(message);
            setGameState(GameState.ERROR);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleLoadGame = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        const savedGameString = localStorage.getItem(SAVE_KEY);

        if (!savedGameString) {
            setErrorMessage("No saved game found.");
            setGameState(GameState.ERROR);
            setIsLoading(false);
            return;
        }

        try {
            const savedGame: SavedGame = JSON.parse(savedGameString);
            if (!savedGame.storyHistory || !savedGame.chatHistory) {
                throw new Error("Save data is corrupted.");
            }
            const session = await resumeAdventure(savedGame.chatHistory);
            setChatSession(session);
            // Defensively set isImageLoading to false for all segments on load
            const loadedStoryHistory = savedGame.storyHistory.map(segment => ({
                ...segment,
                isImageLoading: false, 
            }));
            setStoryHistory(loadedStoryHistory);
            setInventory(savedGame.inventory || []);
            if (savedGame.playerStats) {
                setPlayerStats(savedGame.playerStats);
            } else {
                // Fallback for old saves without stats
                setPlayerStats({
                    health: { current: 100, max: 100 },
                    mana: { current: 50, max: 50 },
                    stamina: { current: 80, max: 80 },
                });
            }
            setGameState(GameState.PLAYING);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred while loading.";
            setErrorMessage(`Failed to load saved game. ${message}`);
            localStorage.removeItem(SAVE_KEY);
            setHasSaveGame(false);
            setGameState(GameState.ERROR);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handlePlayerAction = useCallback(async (action: string) => {
        if (!chatSession) {
            setErrorMessage("The adventure session is not active. Please start a new game.");
            setGameState(GameState.ERROR);
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        const newActionSegment: StorySegment = {
            id: storyHistory.length,
            type: 'action',
            text: action,
        };
        const historyWithAction = [...storyHistory, newActionSegment];
        setStoryHistory(historyWithAction);

        try {
            const rawResponse = await continueAdventure(chatSession, action, inventory, playerStats);
            const { narrative, itemsToAdd, itemsToRemove, imagePrompt, statUpdates } = parseGeminiResponse(rawResponse);
            
            if (Object.keys(statUpdates).length > 0) {
                setPlayerStats(prevStats => {
                    const newStats = JSON.parse(JSON.stringify(prevStats)); // Deep copy
                    for (const statKey in statUpdates) {
                        if (Object.prototype.hasOwnProperty.call(newStats, statKey)) {
                            const change = statUpdates[statKey];
                            const stat = newStats[statKey as keyof PlayerStats];
                            stat.current = Math.max(0, Math.min(stat.max, stat.current + change));
                        }
                    }
                    return newStats;
                });
            }

            if (itemsToAdd.length > 0 || itemsToRemove.length > 0) {
                 const updatedInventory = inventory
                    .filter(item => !itemsToRemove.includes(item))
                    .concat(itemsToAdd);
                 setInventory([...new Set(updatedInventory)]);
            }
            
            const newNarrativeSegment: StorySegment = {
                id: historyWithAction.length,
                type: 'narrative',
                text: narrative,
                isImageLoading: !!imagePrompt,
            };
            
            setStoryHistory(prev => [...prev, newNarrativeSegment]);

            if (imagePrompt) {
                (async () => {
                    try {
                        const base64Data = await generateImage(imagePrompt);
                        const imageUrl = `data:image/png;base64,${base64Data}`;
                         setStoryHistory(prev => prev.map(seg => 
                            seg.id === newNarrativeSegment.id 
                                ? { ...seg, imageUrl, isImageLoading: false } 
                                : seg
                        ));
                    } catch (e) {
                         console.error("Image generation failed:", e);
                         setStoryHistory(prev => prev.map(seg => 
                            seg.id === newNarrativeSegment.id 
                                ? { ...seg, isImageLoading: false }
                                : seg
                        ));
                    }
                })();
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            const errorSegment: StorySegment = {
                id: storyHistory.length + 1,
                type: 'system',
                text: `A mysterious force prevents you from proceeding... (${message})`,
            };
            setStoryHistory(prev => [...prev, errorSegment]);
        } finally {
            setIsLoading(false);
        }
    }, [chatSession, storyHistory, inventory, playerStats]);
    
    const handleRestart = useCallback(() => {
      localStorage.removeItem(SAVE_KEY);
      setHasSaveGame(false);
      setGameState(GameState.START_SCREEN);
      setErrorMessage(null);
      setStoryHistory([]);
      setInventory([]);
      setChatSession(null);
      setPlayerStats({
        health: { current: 100, max: 100 },
        mana: { current: 50, max: 50 },
        stamina: { current: 80, max: 80 },
      });
      setIsSaveDisabledByQuota(false);
    }, []);

    const handleExportStory = useCallback(() => {
        if (storyHistory.length === 0) return;

        const storyText = storyHistory
            .filter(segment => segment.type === 'narrative' || segment.type === 'action')
            .map(segment => {
                if (segment.type === 'action') {
                    return `> ${segment.text}`;
                }
                return segment.text;
            })
            .join('\n\n');

        const blob = new Blob([storyText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gemini-adventure.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [storyHistory]);

    const renderContent = () => {
        if (errorMessage) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                    <h2 className="text-3xl text-red-500 font-bold mb-4">An Unexpected End</h2>
                    <p className="text-gray-300 mb-6 max-w-md">{errorMessage}</p>
                    <button 
                        onClick={handleRestart}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg"
                    >
                        Return to Start
                    </button>
                </div>
            );
        }
        
        switch (gameState) {
            case GameState.START_SCREEN:
                return <StartScreen onStartGame={handleStartGame} isLoading={isLoading} hasSaveGame={hasSaveGame} onLoadGame={handleLoadGame} />;
            case GameState.PLAYING:
                return <GameScreen 
                    storyHistory={storyHistory} 
                    inventory={inventory} 
                    playerStats={playerStats}
                    onSendAction={handlePlayerAction} 
                    isLoading={isLoading}
                    onExportStory={handleExportStory}
                    onRestart={handleRestart} 
                />;
            default:
                 return <StartScreen onStartGame={handleStartGame} isLoading={isLoading} hasSaveGame={hasSaveGame} onLoadGame={handleLoadGame} />;
        }
    };
    
    return <div className="font-mono">{renderContent()}</div>;
};

export default App;
