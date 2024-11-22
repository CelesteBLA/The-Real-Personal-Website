const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const restartButton = document.getElementById('restartButton');
const winImage = new Image();
winImage.src = 'images/nice job.png';
const cheatButton = document.getElementById('cheatButton');


const config = {
    backgroundColor: '#F0EAD6',
    bubbleRadius: 11,
    lineLength: 80,
    brickRowCount: 10,
    brickColumnCount: 16,
    brickPadding: 6,
    brickOffsetTop: 20,
    colors: {
        yellow: "#FFD700",
        blue: "#4EC0D0",
        pink: "#f99fad"
    },
    minMatchCount: 3,
    scorePerPop: 10,
    bubbleSpeed: 5
};


const state = {
    score: 0,
    gameOver: false,
    isWinState: false,
    highScore: Number(localStorage.getItem('bubbleShooterHighScore')) || 0,
    bubbles: [],
    bricks: [],
    lineAngle: Math.PI / 2,
    canShoot: true,
    mouseX: canvas.width / 2,
    mouseY: canvas.height,
    activeColors: new Set()  // Add this line
};



// Calculate brick positions only once
const brickOffsetLeft = (canvas.width - (config.brickColumnCount * (config.bubbleRadius * 2 + config.brickPadding) - config.brickPadding)) / 2;
let nextBubble = getRandomBubbleType();

function getRandomBubbleType() {
    // Convert active colors to array for random selection
    const activeColors = Array.from(state.activeColors);
    if (activeColors.length === 0) return null;
    
    return {
        color: activeColors[Math.floor(Math.random() * activeColors.length)]
    };
}
function updateActiveColors() {
    // Clear the current set of active colors
    state.activeColors.clear();
    
    // Check all bricks to see which colors are still in play
    for (let c = 0; c < config.brickColumnCount; c++) {
        for (let r = 0; r < config.brickRowCount; r++) {
            const brick = state.bricks[c][r];
            if (brick?.status === 1) {
                state.activeColors.add(brick.color);
            }
        }
    }
    
    // If all colors are gone, trigger win state
    if (state.activeColors.size === 0) {
        state.isWinState = true;
        gameOver(true);
    }
}
function initializeBricks() {
    state.bricks = Array(config.brickColumnCount).fill().map((_, c) => 
        Array(config.brickRowCount).fill().map((_, r) => {
            const color = Object.values(config.colors)[Math.floor(Math.random() * Object.keys(config.colors).length)];
            return {
                x: (c * (config.bubbleRadius * 2 + config.brickPadding)) + brickOffsetLeft + config.bubbleRadius,
                y: (r * (config.bubbleRadius * 2 + config.brickPadding)) + config.brickOffsetTop + config.bubbleRadius,
                status: 1,
                color: color
            };
        })
    );
    
    // Add these two lines at the end of the function
    updateActiveColors();
    nextBubble = getRandomBubbleType();
}
function autoWin() {
    let totalBricks = 0;
    // Count and remove all bricks while adding to score
    for (let c = 0; c < config.brickColumnCount; c++) {
        for (let r = 0; r < config.brickRowCount; r++) {
            if (state.bricks[c][r]?.status === 1) {
                state.bricks[c][r].status = 0;
                totalBricks++;
            }
        }
    }
    // Add score for all bricks
    state.score += totalBricks * config.scorePerPop;
    scoreDisplay.textContent = `Score: ${state.score}`;
    
    // Set win state
    state.isWinState = true;
    
    // Trigger game over with win condition
    gameOver(true);
}


function drawBubble(x, y, color, withShadow = true) {
    if (withShadow) {
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, config.bubbleRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
        ctx.closePath();
    }

    ctx.beginPath();
    ctx.arc(x, y, config.bubbleRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    // Highlight effect
    ctx.beginPath();
    ctx.arc(x - config.bubbleRadius / 3, y - config.bubbleRadius / 3, config.bubbleRadius / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    ctx.closePath();
}

function drawShootingLine() {
    const startX = canvas.width / 2;
    const startY = canvas.height - config.bubbleRadius;
    const endX = startX + Math.cos(state.lineAngle) * config.lineLength;
    const endY = startY - Math.sin(state.lineAngle) * config.lineLength;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    // Draw next bubble at the end of line
    drawBubble(endX, endY, nextBubble.color);
}

function drawBricks() {
    state.bricks.forEach(column => {
        column.forEach(brick => {
            if (brick.status === 1) {
                drawBubble(brick.x, brick.y, brick.color);
            }
        });
    });
}

function findMatchingBricks(column, row, color) {
    const matches = [];
    
    // Check all four directions
    const directions = [
        { dx: 1, dy: 0 },  // right
        { dx: -1, dy: 0 }, // left
        { dx: 0, dy: 1 },  // down
        { dx: 0, dy: -1 }  // up
    ];

    for (const dir of directions) {
        const nextCol = column + dir.dx;
        const nextRow = row + dir.dy;
        
        // Check if the position is valid and has a matching brick
        if (nextCol >= 0 && nextCol < config.brickColumnCount &&
            nextRow >= 0 && nextRow < config.brickRowCount) {
            const brick = state.bricks[nextCol][nextRow];
            if (brick && brick.status === 1 && brick.color === color) {
                matches.push({ column: nextCol, row: nextRow });
            }
        }
    }
    
    return matches;
}
function findAdjacentPosition(bubble, collidedBrick) {
    const dx = bubble.x - collidedBrick.x;
    const dy = bubble.y - collidedBrick.y;
    const angle = Math.atan2(dy, dx);
    
    // Get the collision position in grid coordinates
    let newColumn = Math.floor((bubble.x - brickOffsetLeft) / (config.bubbleRadius * 2 + config.brickPadding));
    let newRow = Math.floor((bubble.y - config.brickOffsetTop) / (config.bubbleRadius * 2 + config.brickPadding));
    
    // Ensure we're within bounds
    newColumn = Math.max(0, Math.min(newColumn, config.brickColumnCount - 1));
    newRow = Math.max(0, Math.min(newRow, config.brickRowCount - 1));
    
    return { column: newColumn, row: newRow };
}



function checkCrossPattern(column, row, color) {
    if (!state.bricks[column]?.[row] || state.bricks[column][row].status !== 1) {
        return [];
    }

    const matches = new Set(); // Use Set to avoid duplicates
    matches.add(`${column},${row}`);

    // Define the four directions for cross pattern
    const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 }   // right
    ];

    let foundNewMatches;
    do {
        foundNewMatches = false;
        const currentMatches = Array.from(matches);

        for (const matchKey of currentMatches) {
            const [col, r] = matchKey.split(',').map(Number);
            
            // Check each direction from this matched brick
            for (const dir of directions) {
                let currentCol = col;
                let currentRow = r;

                // Keep going in the current direction as long as we find matching colors
                while (true) {
                    currentCol += dir.dx;
                    currentRow += dir.dy;

                    // Check bounds
                    if (currentCol < 0 || currentCol >= config.brickColumnCount ||
                        currentRow < 0 || currentRow >= config.brickRowCount) {
                        break;
                    }

                    const brick = state.bricks[currentCol][currentRow];
                    if (!brick || brick.status !== 1 || brick.color !== color) {
                        break;
                    }

                    const key = `${currentCol},${currentRow}`;
                    if (!matches.has(key)) {
                        matches.add(key);
                        foundNewMatches = true;
                    }
                }
            }
        }
    } while (foundNewMatches);

    // Convert Set back to array of coordinates
    return Array.from(matches).map(key => {
        const [col, row] = key.split(',').map(Number);
        return { column: col, row: row };
    });
}

function findConnectedMatches(column, row, color, visited = new Set()) {
    const key = `${column},${row}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const matches = [];
    const brick = state.bricks[column]?.[row];
    
    if (!brick || brick.status !== 1 || brick.color !== color) return matches;
    
    matches.push({ column, row });

    // Check all 8 directions
    const directions = [
        { dx: 1, dy: 0 },   // right
        { dx: -1, dy: 0 },  // left
        { dx: 0, dy: 1 },   // down
        { dx: 0, dy: -1 },  // up
        { dx: 1, dy: 1 },   // diagonal down-right
        { dx: -1, dy: 1 },  // diagonal down-left
        { dx: 1, dy: -1 },  // diagonal up-right
        { dx: -1, dy: -1 }  // diagonal up-left
    ];

    for (const dir of directions) {
        const nextCol = column + dir.dx;
        const nextRow = row + dir.dy;
        
        const newMatches = findConnectedMatches(nextCol, nextRow, color, visited);
        matches.push(...newMatches);
    }

    return matches;
}

function convertBubbleToBrick(bubble, bubbleIndex, collidedBrick = null) {
    let column, row;
    
    if (collidedBrick) {
        // Check if the collided brick matches color first
        if (collidedBrick.color === bubble.color) {
            // Get the collided brick's position
            const collidedCol = Math.floor((collidedBrick.x - brickOffsetLeft) / (config.bubbleRadius * 2 + config.brickPadding));
            const collidedRow = Math.floor((collidedBrick.y - config.brickOffsetTop) / (config.bubbleRadius * 2 + config.brickPadding));
            
            // Find all matching bricks in the cross pattern
            const matches = checkCrossPattern(collidedCol, collidedRow, bubble.color);
            
            if (matches.length >= 2) { // We need at least two connected bricks
                // Remove all matching bricks
                matches.forEach(({ column: col, row: r }) => {
                    state.bricks[col][r].status = 0;
                    state.score += config.scorePerPop;
                });
                
                // Remove floating bricks
                removeFloatingBricks();
                updateActiveColors();
                
                scoreDisplay.textContent = `Score: ${state.score}`;
                state.bubbles.splice(bubbleIndex, 1);
                return true;
                nextBubble = getRandomBubbleType();
            }
        }
        
        // If no match or not enough matches, place the bubble adjacent
        const position = findAdjacentPosition(bubble, collidedBrick);
        column = position.column;
        row = position.row;
    } else {
        // Top collision case
        column = Math.floor((bubble.x - brickOffsetLeft) / (config.bubbleRadius * 2 + config.brickPadding));
        row = Math.floor((bubble.y - config.brickOffsetTop) / (config.bubbleRadius * 2 + config.brickPadding));
    }

    // Rest of the function remains the same...
    // Place the bubble if no matches were found
    if (column >= 0 && column < config.brickColumnCount && 
        row >= 0 && row < config.brickRowCount) {
        
        const newBrick = {
            x: (column * (config.bubbleRadius * 2 + config.brickPadding)) + brickOffsetLeft + config.bubbleRadius,
            y: (row * (config.bubbleRadius * 2 + config.brickPadding)) + config.brickOffsetTop + config.bubbleRadius,
            status: 1,
            color: bubble.color
        };

        // If the position is already occupied, try to find a nearby empty spot
        if (state.bricks[column][row]?.status === 1) {
            const directions = [
                {dx: 0, dy: -1},  // up
                {dx: 1, dy: 0},   // right
                {dx: 0, dy: 1},   // down
                {dx: -1, dy: 0},  // left
            ];

            for (const dir of directions) {
                const newCol = column + dir.dx;
                const newRow = row + dir.dy;
                
                if (newCol >= 0 && newCol < config.brickColumnCount &&
                    newRow >= 0 && newRow < config.brickRowCount &&
                    (!state.bricks[newCol][newRow] || state.bricks[newCol][newRow].status !== 1)) {
                    column = newCol;
                    row = newRow;
                    newBrick.x = (column * (config.bubbleRadius * 2 + config.brickPadding)) + brickOffsetLeft + config.bubbleRadius;
                    newBrick.y = (row * (config.bubbleRadius * 2 + config.brickPadding)) + config.brickOffsetTop + config.bubbleRadius;
                    break;
                }
            }
        }

        state.bricks[column][row] = newBrick;
        state.bubbles.splice(bubbleIndex, 1);
        
        return true;
    }
    return false;
}
function isConnectedToTop(column, row, visited = new Set()) {
    const key = `${column},${row}`;
    if (visited.has(key)) return false;
    visited.add(key);
    
    // Base case: at top row and brick exists
    if (row === 0 && state.bricks[column][row]?.status === 1) {
        return true;
    }
    
    // Check if current position has a brick
    if (!state.bricks[column]?.[row]?.status === 1) {
        return false;
    }
    
    // Check adjacent positions
    const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: -1 }, // up-right
        { dx: -1, dy: -1 } // up-left
    ];
    
    for (const dir of directions) {
        const newCol = column + dir.dx;
        const newRow = row + dir.dy;
        
        if (newCol >= 0 && newCol < config.brickColumnCount &&
            newRow >= 0 && newRow < config.brickRowCount) {
            if (state.bricks[newCol][newRow]?.status === 1 && 
                isConnectedToTop(newCol, newRow, visited)) {
                return true;
            }
        }
    }
    
    return false;
}
function removeFloatingBricks() {
    let floatingBricksFound = false;
    
    // Check each brick from bottom to top
    for (let row = config.brickRowCount - 1; row >= 0; row--) {
        for (let column = 0; column < config.brickColumnCount; column++) {
            const brick = state.bricks[column][row];
            if (brick?.status === 1) {
                if (!isConnectedToTop(column, row)) {
                    brick.status = 0;
                    state.score += config.scorePerPop;
                    floatingBricksFound = true;
                }
            }
        }
    }
    
    if (floatingBricksFound) {
        updateActiveColors();
        scoreDisplay.textContent = `Score: ${state.score}`;
    }
}
function collisionDetection() {
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
        const bubble = state.bubbles[i];

        // Wall collisions
        if (bubble.x <= config.bubbleRadius || bubble.x >= canvas.width - config.bubbleRadius) {
            bubble.velocityX *= -1;
        }

        // Top collision
        if (bubble.y <= config.brickOffsetTop + config.bubbleRadius) {
            convertBubbleToBrick(bubble, i);
            continue;
        }

        // Brick collisions
        let collision = false;
        for (let c = 0; c < config.brickColumnCount && !collision; c++) {
            for (let r = 0; r < config.brickRowCount && !collision; r++) {
                const brick = state.bricks[c][r];
                if (brick?.status === 1) {
                    const dx = bubble.x - brick.x;
                    const dy = bubble.y - brick.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < (config.bubbleRadius * 2)) {
                        if (convertBubbleToBrick(bubble, i, brick)) {
                            collision = true;
                        }
                    }
                }
            }
        }

        // Bottom collision (game over)
        if (bubble.y >= canvas.height - config.bubbleRadius) {
            gameOver(false); // Explicitly pass false for regular game over
            state.bubbles.splice(i, 1);
        }
    }
}


function restartGame() {
    state.score = 0;
    state.gameOver = false;
    state.isWinState = false;  // Reset win state
    state.bubbles = [];
    state.canShoot = true;
    scoreDisplay.textContent = 'Score: 0';
    restartButton.style.display = 'none';
    initializeBricks();
    nextBubble = getRandomBubbleType();
    draw();
}
function shootBubble(event) {
    if (!state.canShoot || state.gameOver) return;
    
    const startX = canvas.width / 2;
    const startY = canvas.height - config.bubbleRadius * 2;
    
    // Calculate angle based on mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const dx = mouseX - startX;
    const dy = startY - mouseY; // Reverse Y direction
    const angle = Math.atan2(dy, dx);
    
    // Create new bubble with velocity
    const newBubble = {
        x: startX,
        y: startY,
        color: nextBubble.color,
        velocityX: Math.cos(angle) * config.bubbleSpeed,
        velocityY: -Math.sin(angle) * config.bubbleSpeed
    };
    
    state.bubbles.push(newBubble);
    nextBubble = getRandomBubbleType();
    
    // Add shooting cooldown
    state.canShoot = false;
    setTimeout(() => state.canShoot = true, 500);
}

function updateBubbles() {
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
        const bubble = state.bubbles[i];

        // Update position based on velocity
        bubble.x += bubble.velocityX;
        bubble.y += bubble.velocityY;

        // Wall collisions
        if (bubble.x <= config.bubbleRadius || bubble.x >= canvas.width - config.bubbleRadius) {
            bubble.velocityX *= -1; // Bounce off walls
        }

        // Check if bubble goes beyond the bottom (game over or placement logic)
        if (bubble.y >= canvas.height - config.bubbleRadius) {
            // Place bubble at the bottom in the correct stack/grid position
            placeBubbleAtBottom(bubble);

            // Optionally, check for adjacent bubbles or game logic
            checkForAdjacency(bubble);

            // Remove the bubble from the list
            state.bubbles.splice(i, 1); 
        }
    }
}

 
function placeBubbleAtBottom(bubble) {
    // Example: Put the bubble into the bottom-most available position
    const bottomRow = getBottomRowForColumn(bubble.x);  // Some function to find the column in the grid
    bubble.x = bottomRow.x;  // Set x position to the correct column
    bubble.y = canvas.height - config.bubbleRadius;  // Set y position to the bottom of the canvas

    // Add bubble to the grid or array (you may have a grid structure for game logic)
    grid[bottomRow.x][bottomRow.y] = bubble;
}
function gameOver(isWin = false) {
    state.gameOver = true;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem('bubbleShooterHighScore', state.highScore);
    }
    restartButton.style.display = 'block';
    
    // Clear any remaining bubbles
    state.bubbles = [];
    
    if (isWin) {
        // Draw win screen with custom image
        ctx.save(); // Save the current context state
        
        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the win image with transparency
        ctx.globalAlpha = 0.8;
        ctx.drawImage(winImage, 0, 0, canvas.width, canvas.height);
        
        // Reset alpha for text
        ctx.globalAlpha = 1;
        
        // Add text with shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw "YOU WIN!" text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2);
        
        // Draw score
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 40);
        
        // Draw high score message if applicable
        if (state.score > state.highScore) {
            ctx.fillText('New High Score!', canvas.width / 2, canvas.height / 2 + 80);
        }
        
        ctx.restore(); // Restore the context state
    } else {
        // Regular game over screen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 40);
        if (state.score > state.highScore) {
            ctx.fillText('New High Score!', canvas.width / 2, canvas.height / 2 + 80);
        }
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw game elements only if game is not over
    if (!state.gameOver) {
        drawBricks();
        
        // Draw active bubbles
        state.bubbles.forEach(bubble => {
            drawBubble(bubble.x, bubble.y, bubble.color);
        });
        
        // Draw shooting line and next bubble
        if (state.canShoot) {
            drawShootingLine();
        }

        // Update game state
        collisionDetection();
        updateBubbles();
        requestAnimationFrame(draw);
    } else {
        // Show appropriate end screen
        gameOver(state.isWinState);
    }
}

// Event listeners
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    state.mouseX = mouseX;
    state.mouseY = mouseY;
    
    // Update aiming line angle
    const dx = mouseX - canvas.width / 2;
    const dy = canvas.height - config.bubbleRadius * 2 - mouseY;
    state.lineAngle = Math.atan2(dy, dx);
});

// Use mousedown instead of click for better responsiveness
canvas.addEventListener('mousedown', shootBubble);
restartButton.addEventListener('click', restartGame);
cheatButton.addEventListener('click', autoWin);

// Initialize and start game
initializeBricks();
draw();