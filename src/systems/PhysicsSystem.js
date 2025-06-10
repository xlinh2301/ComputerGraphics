import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class PhysicsSystem {
    constructor() {
        this.gravity = -20;
        this.groundCheckDistance = 20;
        this.minGroundDistance = 0.1;
        this.maxGroundDistance = 15;
        this.airResistance = 0.02;
        this.friction = 0.8;
        this.colliders = [];
        this.groundThreshold = 2.5; // Reduced from 2.0 to 0.5 for more precise ground detection
        this.maxVerticalVelocity = 10; // Maximum upward velocity
        this.maxSlopeAngle = 60; // Maximum angle in degrees for a surface to be considered ground
    }

    // Add a collider to the physics system
    addCollider(object) {
        if (!this.colliders.includes(object)) {
            this.colliders.push(object);
        }
    }

    // Remove a collider from the physics system
    removeCollider(object) {
        const index = this.colliders.indexOf(object);
        if (index !== -1) {
            this.colliders.splice(index, 1);
        }
    }

    // Check if character is on ground
    isOnGround(character, environment) {
        if (!character.character) return false;
        
        const rayStart = character.character.position.clone();
        const rayEnd = rayStart.clone().add(new THREE.Vector3(0, -this.groundCheckDistance, 0));
        
        const raycaster = new THREE.Raycaster(rayStart, rayEnd);
        const intersects = raycaster.intersectObjects(environment.children, true);
        
        if (intersects.length > 0) {
            const distance = intersects[0].distance;
            const hitPoint = intersects[0].point;
            const hitObject = intersects[0].object;
            const hitNormal = intersects[0].face.normal;
            
            const relativeHeight = character.character.position.y - hitPoint.y;
            const upVector = new THREE.Vector3(0, 1, 0);
            const slopeAngle = Math.acos(hitNormal.dot(upVector)) * (180 / Math.PI);
            
            console.log('Ground check:', {
                relativeHeight: relativeHeight,
                hitPoint: hitPoint,
                hitObject: hitObject.name || 'unnamed',
                characterY: character.character.position.y,
                velocityY: character.velocity.y,
                hitNormal: hitNormal,
                slopeAngle: slopeAngle
            });
            
            if (relativeHeight < this.groundThreshold) {
                // Simplified ground check conditions
                if (slopeAngle <= this.maxSlopeAngle && relativeHeight < 0.2) {
                    character.onGround = true;
                    character.velocity.y = 0;
                    // Add a small upward force to prevent sinking
                    character.character.position.y = hitPoint.y + 0.1;
                    console.log('Character is grounded!');
                } else {
                    character.onGround = false;
                }
                return character.onGround;
            }
        }
        
        character.onGround = false;
        return false;
    }

    // Calculate slope angle
    getSlopeAngle(character, environment) {
        if (!character.character) return 0;
        
        const rayStart = character.character.position.clone();
        const rayEnd = rayStart.clone().add(new THREE.Vector3(0, -1, 0));
        
        const raycaster = new THREE.Raycaster(rayStart, rayEnd);
        const intersects = raycaster.intersectObjects(environment.children, true);
        
        if (intersects.length > 0) {
            const normal = intersects[0].face.normal;
            return Math.acos(normal.dot(new THREE.Vector3(0, 1, 0)));
        }
        
        return 0;
    }

    // Apply gravity to character
    applyGravity(character, deltaTime) {
        if (!character.character || !character.velocity) return;
        
        // Apply gravity
        character.velocity.y += this.gravity * deltaTime;
        
        // Debug gravity
        console.log('Applying gravity, new velocity:', character.velocity.y);
    }

    // Apply friction to character
    applyFriction(character, deltaTime) {
        if (!character.character || !character.velocity) return;
        
        if (character.onGround) {
            // Apply stronger friction when no movement input
            const frictionFactor = character.velocity.lengthSq() < 0.001 ? 0.1 : this.friction;
            character.velocity.x *= frictionFactor;
            character.velocity.z *= frictionFactor; 
            
            // Stop completely if velocity is very small
            if (Math.abs(character.velocity.x) < 0.001) character.velocity.x = 0;
            if (Math.abs(character.velocity.z) < 0.001) character.velocity.z = 0;
        }
    }

    // Apply air resistance
    applyAirResistance(character, deltaTime) {
        if (!character.character || !character.velocity) return;
        
        if (!character.onGround) {
            character.velocity.x *= (1 - this.airResistance);
            character.velocity.z *= (1 - this.airResistance);
            
            // Stop completely if velocity is very small
            if (Math.abs(character.velocity.x) < 0.001) character.velocity.x = 0;
            if (Math.abs(character.velocity.z) < 0.001) character.velocity.z = 0;
        }
    }

    // Handle collisions
    handleCollisions(character, environment) {
        if (!character.character) return;

        // Create a small sphere around the character for collision detection
        const characterRadius = 0.5;
        const characterPosition = character.character.position.clone();
        
        // Check for collisions with all objects in the environment
        environment.children.forEach(object => {
            if (object.geometry) {
                // Get the closest point on the object to the character
                const closestPoint = this.getClosestPointOnObject(characterPosition, object);
                const distance = characterPosition.distanceTo(closestPoint);
                
                // If collision detected
                if (distance < characterRadius) {
                    // Calculate collision response
                    const collisionNormal = characterPosition.clone().sub(closestPoint).normalize();
                    
                    // If collision is from below (character is being pushed up)
                    if (collisionNormal.y > 0.5) {
                        // Reduce upward velocity
                        character.velocity.y *= 0.5;
                        
                        // Move character away from collision
                        const pushDistance = characterRadius - distance;
                        character.character.position.add(collisionNormal.multiplyScalar(pushDistance * 0.5));
                    }
                }
            }
        });
    }

    // Get closest point on an object to a given point
    getClosestPointOnObject(point, object) {
        if (!object.geometry) return point;
        
        // Convert object geometry to world space
        const geometry = object.geometry;
        const vertices = geometry.attributes.position.array;
        let closestPoint = new THREE.Vector3();
        let minDistance = Infinity;
        
        // Check each vertex
        for (let i = 0; i < vertices.length; i += 3) {
            const vertex = new THREE.Vector3(
                vertices[i],
                vertices[i + 1],
                vertices[i + 2]
            ).applyMatrix4(object.matrixWorld);
            
            const distance = point.distanceTo(vertex);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint.copy(vertex);
            }
        }
        
        return closestPoint;
    }

    // Update physics for a character
    update(character, environment, deltaTime) {
        if (!character.character) return;

        // Apply gravity first
        if (!character.onGround) {
            this.applyGravity(character, deltaTime);
        }

        // Then check ground
        this.isOnGround(character, environment);
        
        // Apply air resistance
        this.applyAirResistance(character, deltaTime);
        
        // Handle collisions
        this.handleCollisions(character, environment);

        // Limit vertical velocity
        if (character.velocity.y > this.maxVerticalVelocity) {
            character.velocity.y = this.maxVerticalVelocity;
        }
    }
} 