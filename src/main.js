// ==========================================
// IMPORTS
// ==========================================
import * as THREE from 'three';
import * as CANNON from '../node_modules/cannon-es/dist/cannon-es.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Scene } from './core/Scene.js';
import { Character } from './components/Character.js';
import { Environment } from './components/Environment.js';
import { InputSystem } from './systems/InputSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { createTrimesh } from './utils/three-to-cannon.js';

// ==========================================
// GAME CLASS
// ==========================================
class Game {
    constructor() {
        this.scene = new Scene();
        this.scene.setupLights();
        
        this.physicsSystem = new PhysicsSystem();
        this.character = new Character(this.scene.scene, this.physicsSystem);
        this.environment = new Environment(this.scene.scene);
        this.inputSystem = new InputSystem();
        this.cameraSystem = new CameraSystem(this.scene.camera, this.scene.renderer);
        
        this.clock = new THREE.Clock();
        this.moveSpeed = 20;
        this.runSpeedMultiplier = 2;
        
        this.setupEventListeners();
        this.init();
    }

    async init() {
        try {
            await this.environment.load();
            await this.character.load();
            
            // Set character position to desired coordinates
            const desiredPosition = new THREE.Vector3(-348.39, 5, 192.64);
            this.character.setInitialPosition(desiredPosition);
            this.character.body.position.copy(desiredPosition);
            // console.log('Character position:', this.character.character.position);
            
            // Add environment objects as colliders
            this.environment.environment.traverse((object) => {
                if (object.isMesh) {
                    let shape;
                    let shapeType = '';
                    // For simple box-like objects, use a Box shape for better performance and stability
                    if (object.name.startsWith('ground') || object.name.startsWith('Object')) {
                        shapeType = 'Box';
                        object.geometry.computeBoundingBox();
                        const box = object.geometry.boundingBox;
                        const size = new THREE.Vector3();
                        box.getSize(size);

                        // Apply the world scale of the object to the size of the box
                        const worldScale = new THREE.Vector3();
                        object.getWorldScale(worldScale);
                        size.multiply(worldScale);

                        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
                    } else {
                        // For complex shapes, we need to apply scale to the vertices before creating the trimesh
                        const clonedGeom = object.geometry.clone();
                        const worldScale = new THREE.Vector3();
                        object.getWorldScale(worldScale);
                        clonedGeom.scale(worldScale.x, worldScale.y, worldScale.z);

                        shape = createTrimesh(clonedGeom);
                        shapeType = 'Trimesh';
                    }

                    console.log(`Creating physics body for: ${object.name}, Shape: ${shapeType}`);

                    const body = new CANNON.Body({ 
                        mass: 0, 
                        shape: shape,
                        material: this.physicsSystem.groundMaterial, // Use shared material
                        collisionFilterGroup: PhysicsSystem.GROUND_GROUP,
                        collisionFilterMask: PhysicsSystem.CHARACTER_GROUP
                    });
                    body.position.copy(object.getWorldPosition(new THREE.Vector3()));
                    body.quaternion.copy(object.getWorldQuaternion(new THREE.Quaternion()));
                    this.physicsSystem.addBody(body);
                }
            });
            
            this.cameraSystem.setup(this.character.character);
            
            this.animate();
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.scene.handleResize());
        
        this.scene.renderer.domElement.addEventListener('click', () => {
            this.inputSystem.requestPointerLock(this.scene.renderer.domElement);
        });
        
        document.addEventListener('mousemove', (event) => {
            if (this.inputSystem.isPointerLocked) {
                this.cameraSystem.handleMouseMove(event, this.character.character);
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.inputSystem.exitPointerLock();
            }
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            const groundPosition = this.environment.getGroundPosition();
            this.character.body.position.copy(groundPosition);
            this.character.body.velocity.set(0, 0, 0);
            this.character.onGround = false;
            
            this.cameraSystem.update(this.character.character, 0);
        });
    }

    handleInput(deltaTime) {
        if (!this.character.character) return;
        
        // Get movement direction from input
        const moveDirection = this.inputSystem.getMovementDirection();
        
        // Get camera direction for relative movement
        const cameraDirection = this.scene.camera.quaternion;
        
        // Update character states
        this.character.setRunning(this.inputSystem.isRunPressed());
        this.character.setCrouching(this.inputSystem.isCrouchPressed());
        this.character.setProne(this.inputSystem.isPronePressed());
        
        // Move character relative to camera direction
        this.character.move(moveDirection, cameraDirection, deltaTime);
        
        // Handle jump
        if (this.inputSystem.isJumpPressed()) {
            this.character.jump();
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = Math.min(this.clock.getDelta(), 0.016);
        
        if (!this.character.character) return;
        
        if (this.character.mixer) {
            this.character.mixer.update(deltaTime);
        }
        
        this.handleInput(deltaTime);
        
        // Update physics
        this.physicsSystem.update(deltaTime);
        
        this.character.update(deltaTime);
        this.cameraSystem.update(this.character.character, deltaTime);
        
        // Log character position
        // console.log('Character position:', {
        //     x: this.character.character.position.x.toFixed(2),
        //     y: this.character.character.position.y.toFixed(2),
        //     z: this.character.character.position.z.toFixed(2)
        // });
        
        this.scene.renderer.render(this.scene.scene, this.scene.camera);
    }
}

// ==========================================
// GAME INITIALIZATION
// ==========================================
const game = new Game();

