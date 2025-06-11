import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from '../../node_modules/cannon-es/dist/cannon-es.js';

export class PhysicsSystem {
    // Collision groups
    static CHARACTER_GROUP = 1;
    static GROUND_GROUP = 2;

    constructor() {
        // Create a Cannon-es world
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -20, 0), // Set gravity
        });

        // Increase solver iterations for more accuracy
        this.world.solver.iterations = 15;
        this.world.allowSleep = true;

        // Define materials
        this.groundMaterial = new CANNON.Material('ground');
        this.characterMaterial = new CANNON.Material('character');

        // Define interaction between materials
        const groundCharacterContact = new CANNON.ContactMaterial(
            this.groundMaterial,
            this.characterMaterial,
            {
                friction: 1.0, // Increased friction significantly to prevent slipping
                restitution: 0.0, // No bounciness
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3,
                frictionEquationStiffness: 1e8, // Add stiffness for friction
            }
        );

        this.world.addContactMaterial(groundCharacterContact);

        this.bodies = [];
    }

    addBody(body) {
        this.world.addBody(body);
        this.bodies.push(body);
    }

    removeBody(body) {
        this.world.removeBody(body);
        const index = this.bodies.indexOf(body);
        if (index !== -1) {
            this.bodies.splice(index, 1);
        }
    }

    // Update the physics world
    update(deltaTime) {
        // Step the physics world with more substeps to prevent tunneling
        this.world.step(1 / 60, deltaTime, 10);
    }
} 