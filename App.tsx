import React, { useState, useCallback, useEffect } from 'react';
import type { StorySegment, AdventureGenre, ChatSession, SavedGame } from './types';
import { GameState } from './types';
import { StartScreen } from './components/StartScreen';
import { GameScreen } from './components/GameScreen';
import { startAdventure, continueAdventure, resumeAdventure } from './services/geminiService';

const SAVE_KEY = 'geminiAdventureSave';

const parseGeminiResponse = (responseText: string): { narrative: string; itemsToAdd: string[]; itemsToRemove: string[] } => {
    const narrativeLines = [];
    const itemsToAdd: string[] = [];
    const itemsToRemove: string[] = [];
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
        narrativeLines.push(line);
    }

    return {
        narrative: narrativeLines.join('\n').trim(),
        itemsToAdd,
        itemsToRemove
    };
};


const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(GameState.START_SCREEN);
    const [storyHistory, setStoryHistory] = useState<StorySegment[]>([]);
    const [inventory, setInventory] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [chatSession, setChatSession] = useState<ChatSession | null>(null);
    const [hasSaveGame, setHasSaveGame] = useState<boolean>(false);

    useEffect(() => {
        try {
            const savedGame = localStorage.getItem(SAVE_KEY);
            setHasSaveGame(!!savedGame);
        } catch (error) {
            console.error("Could not access localStorage:", error);
            setHasSaveGame(false);
        }
    }, []);

    const handleStartGame = useCallback(async (genre: AdventureGenre) => {
        setIsLoading(true);
        setErrorMessage(null);
        setStoryHistory([]);
        setInventory([]);

        try {
            localStorage.removeItem(SAVE_KEY);
            setHasSaveGame(false);

            const { session, opening } = await startAdventure(genre);
            setChatSession(session);
            setStoryHistory([{ id: 0, type: 'narrative', text: opening }]);
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
            setStoryHistory(savedGame.storyHistory);
            setInventory(savedGame.inventory || []);
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
        setStoryHistory(prev => [...prev, newActionSegment]);

        try {
            const rawResponse = await continueAdventure(chatSession, action, inventory);
            const { narrative, itemsToAdd, itemsToRemove } = parseGeminiResponse(rawResponse);
            
            const newNarrativeSegment: StorySegment = {
                id: storyHistory.length + 1,
                type: 'narrative',
                text: narrative,
            };
            
            // Update inventory based on commands
            let updatedInventory = [...inventory];
            if(itemsToAdd.length > 0 || itemsToRemove.length > 0) {
                 updatedInventory = inventory
                    .filter(item => !itemsToRemove.includes(item))
                    .concat(itemsToAdd);
                 // remove duplicates
                 updatedInventory = [...new Set(updatedInventory)];
                 setInventory(updatedInventory);
            }

            setStoryHistory(prev => {
                const updatedHistory = [...prev, newNarrativeSegment];
                
                const saveGame = async () => {
                    try {
                        const chatHistory = await chatSession.getHistory();
                        const saveData: SavedGame = { storyHistory: updatedHistory, chatHistory, inventory: updatedInventory };
                        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
                        setHasSaveGame(true);
                    } catch (e) {
                        console.error("Failed to save game:", e);
                         const errorSegment: StorySegment = {
                            id: updatedHistory.length,
                            type: 'system',
                            text: `(System: Failed to save progress.)`,
                        };
                         setStoryHistory(prev => [...prev, errorSegment]);
                    }
                };
                saveGame();

                return updatedHistory;
            });

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
    }, [chatSession, storyHistory, inventory]);
    
    const handleRestart = useCallback(() => {
      localStorage.removeItem(SAVE_KEY);
      setHasSaveGame(false);
      setGameState(GameState.START_SCREEN);
      setErrorMessage(null);
      setStoryHistory([]);
      setInventory([]);
      setChatSession(null);
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