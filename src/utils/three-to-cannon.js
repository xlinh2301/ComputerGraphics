import * as THREE from 'three';
import * as CANNON from '../../node_modules/cannon-es/dist/cannon-es.js';

/**
 * Converts a THREE.Box3 to a CANNON.Box shape.
 * @param {THREE.Box3} box3
 * @returns {CANNON.Box}
 */
function box3ToCannonBox(box3) {
    const size = new THREE.Vector3();
    box3.getSize(size);
    return new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
}

/**
 * Creates a Cannon.js body from a THREE.Object3D
 * @param {THREE.Object3D} object
 * @param {object} options
 * @param {number} options.mass
 * @param {CANNON.Material} options.material
 * @returns {CANNON.Body}
 */
export function createCannonBody(object, options = {}) {
    const { mass = 0, material = new CANNON.Material('default') } = options;

    let shape;
    if (object.isMesh) {
        const geometry = object.geometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        shape = box3ToCannonBox(box);
    } else {
        // For groups or other objects, create a bounding box for all children
        const box = new THREE.Box3().setFromObject(object);
        shape = box3ToCannonBox(box);
    }

    const body = new CANNON.Body({
        mass,
        shape,
        material,
    });

    // Copy position and quaternion
    body.position.copy(object.getWorldPosition(new THREE.Vector3()));
    body.quaternion.copy(object.getWorldQuaternion(new THREE.Quaternion()));

    return body;
}

/**
 * Creates a Trimesh shape from a THREE.Geometry.
 * @param {THREE.BufferGeometry} geometry
 * @returns {CANNON.Trimesh}
 */
export function createTrimesh(geometry) {
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : undefined;

    if (!indices) {
        const indicesArr = [];
        for (let i = 0; i < vertices.length / 3; i++) {
            indicesArr.push(i);
        }
        return new CANNON.Trimesh(vertices, indicesArr);
    }

    return new CANNON.Trimesh(vertices, indices);
} 