import * as THREE from 'three';

export class InputSystem {
    constructor() {
        this.keys = new Set();
        this.isPointerLocked = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.movementX = 0;
        this.movementY = 0;
        this.isCrouching = false;
        this.isProne = false;
        
        // Add movement smoothing
        this.movementSmoothing = 0.8;
        this.lastDirection = { x: 0, z: 0 };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            this.keys.add(key);
            
            // Toggle crouch/prone
            if (key === 'control' || key === 'c') {
                if (this.isProne) {
                    this.isProne = false;
                    this.isCrouching = true;
                } else if (this.isCrouching) {
                    this.isCrouching = false;
                } else {
                    this.isCrouching = true;
                }
            }

            // Debug log for space key
            if (key === ' ' || key === 'space') {
                console.log('[DEBUG] Space key pressed - Jump input detected');
                console.log('[DEBUG] Current keys:', Array.from(this.keys));
            }
        });

        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            this.keys.delete(key);
            
            // Reset crouch/prone on key release
            if (key === 'control' || key === 'c') {
                this.isCrouching = false;
                this.isProne = false;
            }

            // Debug log for space key
            if (key === ' ' || key === 'space') {
                console.log('[DEBUG] Space key released');
                console.log('[DEBUG] Current keys:', Array.from(this.keys));
            }
        });

        // Mouse events
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                this.movementX = event.movementX || 0;
                this.movementY = event.movementY || 0;
                this.mouseX += this.movementX;
                this.mouseY += this.movementY;
            }
        });

        // Pointer lock events
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement !== null;
        });

        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
            this.isPointerLocked = false;
        });
    }

    requestPointerLock(element) {
        if (!element) return;
        
        try {
            element.requestPointerLock();
        } catch (error) {
            console.error('Error requesting pointer lock:', error);
        }
    }

    exitPointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    getMovementDirection() {
        const direction = { x: 0, z: 0 };
        let isMoving = false;

        // Forward/Backward movement
        if (this.keys.has('w')) {
            direction.z = -1; // Move forward
            isMoving = true;
        }
        // if (this.keys.has('s')) {
        //     direction.z = 1; // Move backward
        //     isMoving = true;
        // }

        // // Left/Right movement
        // if (this.keys.has('a')) {
        //     direction.x = -1; // Move left
        //     isMoving = true;
        // }
        // if (this.keys.has('d')) {
        //     direction.x = 1; // Move right
        //     isMoving = true;
        // }

        // If no keys are pressed, stop immediately
        if (!isMoving) {
            this.lastDirection = { x: 0, z: 0 };
            return { x: 0, z: 0 }; // Return zero direction immediately
        }

        // Normalize direction if moving
        const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        if (length > 0) {
            direction.x /= length;
            direction.z /= length;
        }

        // Update last direction without smoothing
        this.lastDirection = { x: direction.x, z: direction.z };

        return direction;
    }

    isRunPressed() {
        return this.keys.has('shift');
    }

    isJumpPressed() {
        return this.keys.has(' ') || this.keys.has('space');
    }

    isCrouchPressed() {
        return this.isCrouching;
    }

    isPronePressed() {
        return this.isProne;
    }

    getMouseMovement() {
        const movement = {
            x: this.movementX,
            y: this.movementY
        };
        
        // Reset movement after reading
        this.movementX = 0;
        this.movementY = 0;
        
        return movement;
    }
} 