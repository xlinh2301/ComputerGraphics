import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.character = null;
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        
        // Physics properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.jumpForce = 15; // Increased jump force
        this.walkSpeed = 5;
        this.runSpeed = 10;
        this.crouchSpeed = 2;
        this.proneSpeed = 1;
        this.rotationSpeed = 2;
        this.stepOffset = 0.3; // Height of steps the character can climb
        
        // Movement states
        this.isRunning = false;
        this.isCrouching = false;
        this.isProne = false;

        // Reset properties
        this.minHeight = -10; // Height threshold for reset
        this.initialPosition = new THREE.Vector3(0, 0, 0);
    }

    async load() {
        const loader = new GLTFLoader();
        try {
            // Load character model
            const gltf = await loader.loadAsync('../../public/models/character/luoli_run.glb');
            this.character = gltf.scene;
            
            // Set initial scale
            this.character.scale.set(0.02, 0.02, 0.02);
            
            // Set initial position from initialPosition
            this.character.position.copy(this.initialPosition);
            
            // Add to scene
            this.scene.add(this.character);

            // Setup animations
            if (gltf.animations && gltf.animations.length) {
                this.mixer = new THREE.AnimationMixer(this.character);
                gltf.animations.forEach((clip) => {
                    this.animations[clip.name] = this.mixer.clipAction(clip);
                    // Set all animations to not loop by default
                    this.animations[clip.name].setLoop(THREE.LoopOnce);
                    this.animations[clip.name].clampWhenFinished = true;
                });
                
                // Play idle animation if exists
                const idleAnim = this.animations['idle'] || this.animations[Object.keys(this.animations)[0]];
                if (idleAnim) {
                    idleAnim.setLoop(THREE.LoopRepeat);
                    idleAnim.play();
                    this.currentAnimation = idleAnim;
                }
            }

            // Enable shadows
            this.character.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
        } catch (error) {
            console.error('Error loading character:', error);
        }
    }

    playAnimation(name, loop = true) {
        if (!this.animations[name]) return;
        
        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }
        
        this.animations[name].setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        this.animations[name].reset();
        this.animations[name].play();
        this.currentAnimation = this.animations[name];
    }

    move(direction, cameraDirection, deltaTime) {
        if (!this.character) return;

        // If no movement input, stop the character completely
        if (direction.x === 0 && direction.z === 0) {
            this.velocity.set(0, this.velocity.y, 0); // Keep only vertical velocity for gravity
            return;
        }

        // Calculate movement speed based on state
        let speed = this.walkSpeed;
        if (this.isRunning) speed = this.runSpeed;
        if (this.isCrouching) speed = this.crouchSpeed;
        if (this.isProne) speed = this.proneSpeed;

        // Calculate movement direction relative to camera
        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraDirection);
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraDirection);
        
        // Remove vertical component
        cameraForward.y = 0;
        cameraRight.y = 0;
        cameraForward.normalize();
        cameraRight.normalize();

        // Calculate final movement direction
        const moveDirection = new THREE.Vector3();
        moveDirection.addScaledVector(cameraForward, -direction.z);
        moveDirection.addScaledVector(cameraRight, direction.x);
        
        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
        }

        // Calculate movement
        const moveX = moveDirection.x * speed * deltaTime;
        const moveZ = moveDirection.z * speed * deltaTime;

        // Update velocity
        this.velocity.x = moveX;
        this.velocity.z = moveZ;

        // Update position
        this.character.position.x += moveX;
        this.character.position.z += moveZ;

        // Update rotation if moving
        if (moveDirection.lengthSq() > 0) {
            const angle = Math.atan2(moveDirection.x, moveDirection.z);
            this.character.rotation.y = angle;
            
            // Play appropriate animation
            if (this.isRunning) {
                this.playAnimation('run', true);
            } else if (this.isCrouching) {
                this.playAnimation('crouch_walk', true);
            } else if (this.isProne) {
                this.playAnimation('prone', true);
            } else {
                this.playAnimation('walk', true);
            }
        } else {
            // Play idle animation
            if (this.isCrouching) {
                this.playAnimation('crouch_idle', true);
            } else if (this.isProne) {
                this.playAnimation('prone_idle', true);
            } else {
                this.playAnimation('idle', true);
            }
        }
    }

    jump() {
        if (!this.onGround) {
            console.log('Cannot jump: Not on ground');
            return;
        }
        
        console.log('Jumping with force:', this.jumpForce);
        this.velocity.y = this.jumpForce;
        this.onGround = false;
        
        // Force update position to start the jump
        if (this.character) {
            this.character.position.y += 0.1; // Small offset to start the jump
        }
        
        // Play jump animation
        this.playAnimation('jump', false);
    }

    setRunning(isRunning) {
        this.isRunning = isRunning;
    }

    setCrouching(isCrouching) {
        this.isCrouching = isCrouching;
        // Adjust character height/scale for crouching
        if (isCrouching) {
            this.character.scale.y = 0.02 * 0.7; // Reduce height to 70%
        } else {
            this.character.scale.y = 0.02; // Reset to normal height
        }
    }

    setProne(isProne) {
        this.isProne = isProne;
        // Adjust character height/scale for prone
        if (isProne) {
            this.character.scale.y = 0.02 * 0.3; // Reduce height to 30%
        } else {
            this.character.scale.y = 0.02; // Reset to normal height
        }
    }

    rotate(angle) {
        if (this.character) {
            this.character.rotation.y = angle;
        }
    }

    update(deltaTime, environment) {
        if (!this.character) return;

        // Update animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Update character position based on velocity
        const oldPosition = this.character.position.clone();
        this.character.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Debug velocity
        if (this.velocity.y !== 0) {
            console.log('Current velocity:', this.velocity.y);
        }
        
        // Check if character has fallen below threshold
        if (this.character.position.y < this.minHeight) {
            this.resetPosition();
        }
    }

    resetPosition() {
        if (!this.character) return;
        
        // Reset position to initial position
        this.character.position.copy(this.initialPosition);
        
        // Reset velocity
        this.velocity.set(0, 0, 0);
        
        // Reset ground state
        this.onGround = false;
        
        // Play idle animation
        this.playAnimation('idle', true);
    }

    setInitialPosition(position) {
        this.initialPosition.copy(position);
    }
} 