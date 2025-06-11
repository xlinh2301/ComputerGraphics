import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from '../../node_modules/cannon-es/dist/cannon-es.js';
import { createTrimesh } from '../utils/three-to-cannon.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';

export class Character {
    constructor(scene, physicsSystem) {
        this.scene = scene;
        this.physicsSystem = physicsSystem;
        this.character = null;
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        
        // Physics properties
        this.body = null; // CANNON.Body
        this.onGround = false;
        this.jumpForce = 15;
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

    createBody() {
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.9, 0.5));
        
        this.body = new CANNON.Body({
            mass: 5,
            position: new CANNON.Vec3().copy(this.character.position),
            shape: shape,
            material: this.physicsSystem.characterMaterial, // Use shared material
            collisionFilterGroup: PhysicsSystem.CHARACTER_GROUP,
            collisionFilterMask: PhysicsSystem.GROUND_GROUP
        });
        this.body.linearDamping = 0.9; // To prevent sliding
        this.body.fixedRotation = true; // Prevent character from tipping over
        this.body.allowSleep = false;
        this.physicsSystem.addBody(this.body);
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

            this.createBody(); // Create physics body after loading model

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
            // Stop horizontal movement
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
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
        const moveX = moveDirection.x * speed;
        const moveZ = moveDirection.z * speed;

        // Update velocity
        this.body.velocity.x = moveX;
        this.body.velocity.z = moveZ;

        // Update position
        this.character.position.x += moveX;
        this.character.position.z += moveZ;

        // Update rotation if moving
        if (moveDirection.lengthSq() > 0) {
            const angle = Math.atan2(moveDirection.x, moveDirection.z);
            this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
            
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
        this.checkIfOnGround();
        if (!this.onGround) {
            console.log('Cannot jump: Not on ground');
            return;
        }
        
        console.log('Jumping with force:', this.jumpForce);
        this.body.velocity.y = this.jumpForce;
        this.onGround = false;
        
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

    checkIfOnGround() {
        const raycastStart = this.body.position;
        // The character box half-height is 0.9. We cast a ray slightly longer than that.
        const raycastEnd = new CANNON.Vec3(raycastStart.x, raycastStart.y - 0.91, raycastStart.z);
        
        const result = new CANNON.RaycastResult();
        const world = this.physicsSystem.world;

        const raycastOptions = {
            collisionFilterGroup: PhysicsSystem.CHARACTER_GROUP,
            collisionFilterMask: PhysicsSystem.GROUND_GROUP,
            skipBackfaces: true
        };

        this.onGround = world.raycastClosest(raycastStart, raycastEnd, raycastOptions, result);

        if (this.onGround) {
            // Check if the surface is flat enough to be considered ground
            // A normal pointing straight up has a dot product of 1 with the up vector.
            // We allow for some slope, e.g., up to 45 degrees (cos(45) ~ 0.707)
            const groundNormal = result.hitNormalWorld;
            const upVector = new CANNON.Vec3(0, 1, 0);
            const slopeAngle = groundNormal.dot(upVector);
            
            if (slopeAngle < 0.7) {
                this.onGround = false;
            }
        }
    }

    update(deltaTime) {
        if (!this.character || !this.body) return;

        this.checkIfOnGround();

        // --- Ground Adhesion ---
        // If on ground, apply a small downward velocity to stick to the surface
        if (this.onGround && this.body.velocity.y <= 0) {
            this.body.velocity.y = -2;
        }

        // --- Keep character upright ---
        // Get current orientation in Euler angles
        const euler = new CANNON.Vec3();
        this.body.quaternion.toEuler(euler);

        // Create a new quaternion with only the rotation around the Y axis
        const newQuaternion = new CANNON.Quaternion();
        newQuaternion.setFromEuler(0, euler.y, 0);
        this.body.quaternion.copy(newQuaternion);

        // Also explicitly zero out angular velocity on x and z axes
        this.body.angularVelocity.x = 0;
        this.body.angularVelocity.z = 0;
        // --- End keep upright ---

        // Update character position and rotation from physics body
        this.character.position.copy(this.body.position);
        this.character.quaternion.copy(this.body.quaternion);
        
        // Fall reset
        if (this.character.position.y < this.minHeight) {
            this.resetPosition();
        }

        // Update animations
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    resetPosition() {
        if (!this.character || !this.body) return;
        
        // Reset position to initial position
        this.body.position.copy(this.initialPosition);
        
        // Reset velocity
        this.body.velocity.set(0, 0, 0);
        this.body.angularVelocity.set(0, 0, 0);
        
        // Reset ground state
        this.onGround = false;
        
        // Play idle animation
        this.playAnimation('idle', true);
    }

    setInitialPosition(position) {
        this.initialPosition.copy(position);
    }
} 