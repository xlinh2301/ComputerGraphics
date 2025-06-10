import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraSystem {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.target = new THREE.Vector3();
        this.offset = new THREE.Vector3(0, 5, 5); // Position camera behind and slightly above character
        this.currentRotation = new THREE.Euler();
        this.sensitivity = 0.002;
    }

    setup(character) {
        if (!character) return;
        
        this.target.copy(character.position);
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);
        
        // Store initial rotation
        this.currentRotation.copy(this.camera.rotation);
    }

    handleMouseMove(event, character) {
        if (!character) return;

        const movement = {
            x: event.movementX || 0,
            y: event.movementY || 0
        };

        // Update rotation
        this.currentRotation.y -= movement.x * this.sensitivity;
        this.currentRotation.x -= movement.y * this.sensitivity;

        // Clamp vertical rotation
        this.currentRotation.x = Math.max(
            -Math.PI / 3,
            Math.min(Math.PI / 3, this.currentRotation.x)
        );

        // Update camera rotation
        this.camera.rotation.copy(this.currentRotation);

        // Update character rotation to match camera's horizontal rotation
        character.rotation.y = this.currentRotation.y;
    }

    update(character, deltaTime) {
        if (!character) return;

        // Update target position
        this.target.copy(character.position);
        
        // Calculate camera position based on character's rotation
        const idealOffset = new THREE.Vector3();
        idealOffset.setFromSphericalCoords(
            this.offset.length(),
            this.currentRotation.x + Math.PI / 2,
            this.currentRotation.y
        );
        
        // Smoothly move camera to ideal position
        this.camera.position.lerp(
            this.target.clone().add(idealOffset),
            Math.min(1, deltaTime * 10)
        );
        
        // Look at target
        this.camera.lookAt(this.target);
    }
} 