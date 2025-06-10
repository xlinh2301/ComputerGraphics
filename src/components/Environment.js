import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.environment = null;
        this.scale = 30;
    }

    load() {
        const loader = new GLTFLoader();
        
        return new Promise((resolve, reject) => {
            loader.load('../public/models/environment/parkour1.glb', (gltf) => {
                this.environment = gltf.scene;
                this.environment.scale.set(this.scale, this.scale, this.scale);
                this.scene.add(this.environment);
                
                this.environment.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                
                let meshCount = 0;
                // this.environment.traverse(child => {
                //     if (child.isMesh) {
                //         meshCount++;
                //         console.log('Mesh found:', child.name, 'position:', child.position, 'geometry:', child.geometry);
                //     }
                // });
                // console.log('Total mesh:', meshCount);
                
                // Tìm mesh có vị trí y thấp nhất và diện tích lớn nhất để gán là ground
                let groundMesh = null;
                let maxArea = 0;

                this.environment.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.computeBoundingBox();
                        const bbox = child.geometry.boundingBox;
                        const size = bbox.max.clone().sub(bbox.min);
                        const area = size.x * size.z;
                        // Ưu tiên mesh có diện tích lớn và vị trí y thấp
                        if (area > maxArea && Math.abs(child.position.y) < 1) {
                            maxArea = area;
                            groundMesh = child;
                        }
                    }
                });

                if (groundMesh) {
                    groundMesh.name = 'ground';
                    console.log('Đã gán tên ground cho mesh:', groundMesh);
                }
                
                resolve(this.environment);
            }, undefined, (error) => {
                console.error('Error loading environment:', error);
                reject(error);
            });
        });
    }

    getGroundPosition() {
        const groundPosition = new THREE.Vector3();
        const groundMesh = this.environment?.getObjectByName('ground');
        if (groundMesh) {
            groundMesh.getWorldPosition(groundPosition);
        } else {
            groundPosition.set(0, 2, 0);
        }
        return groundPosition;
    }

    // Get all properties of environment
    getEnvironmentProperties() {
        if (!this.environment) {
            console.log('Environment not loaded');
            return;
        }

        console.log('Environment properties:');
        
        // Log direct properties
        console.log('Direct properties:', Object.keys(this.environment));
        
        // Log children objects
        console.log('Number of children:', this.environment.children.length);
        this.environment.children.forEach((child, index) => {
            console.log(`Child ${index}:`, {
                name: child.name,
                type: child.type,
                position: child.position,
                rotation: child.rotation,
                scale: child.scale
            });
        });

        // Log all meshes
        const meshes = [];
        this.environment.traverse(node => {
            if (node.isMesh) {
                meshes.push({
                    name: node.name,
                    geometry: node.geometry.type,
                    material: node.material.type
                });
            }
        });
        console.log('Meshes:', meshes);
    }
} 