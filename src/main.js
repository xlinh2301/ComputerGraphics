import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Khai báo biến ---
let mixer = null;
let characterModel = null;
let animations = {};
const clock = new THREE.Clock();
let currentAction = null;
let scene, camera, renderer, controls; 

// 1. Lấy container
const container = document.getElementById('app');
if (!container) {
    throw new Error("Container #app not found!");
}

// Gọi hàm khởi tạo chính
init();

// --- Hàm Khởi tạo Chính ---
function init() {
    // 2. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // 3. Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    // Vị trí camera ban đầu 
    camera.position.set(0, 5, 12); 
    // camera.lookAt(0, 1, 0); // OrbitControls sẽ quản lý việc lookAt

    // 4. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement); // Phải thêm renderer vào DOM trước khi tạo Controls

    // --- 5. Khởi tạo OrbitControls ---
    // Cần camera và element của renderer để lắng nghe sự kiện chuột/touch
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Tạo hiệu ứng mượt mà khi dừng xoay (tùy chọn)
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false; // Giữ panning trên mặt phẳng ngang (tùy chọn)
    controls.minDistance = 3; // Khoảng cách zoom gần nhất (tùy chọn)
    controls.maxDistance = 50; // Khoảng cách zoom xa nhất (tùy chọn)
    // Đặt mục tiêu camera nhìn vào (ví dụ: gốc tọa độ hoặc vị trí nhân vật)
    controls.target.set(0, 1, 0); // Đặt target cao ngang tầm nhân vật
    controls.update(); // Cập nhật controls lần đầu

    // 6. Lighting
    setupLighting();

    // 7. Load Models
    loadModels();

    // 8. Resize Listener
    window.addEventListener('resize', onWindowResize);

    // 9. Start Animation Loop
    animate();

    console.log("Three.js scene initialized with OrbitControls. Attempting to load models.");
}

// --- Hàm Thiết lập Ánh sáng ---
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    const shadowCamSize = 20;
    directionalLight.shadow.camera.left = -shadowCamSize;
    directionalLight.shadow.camera.right = shadowCamSize;
    directionalLight.shadow.camera.top = shadowCamSize;
    directionalLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(directionalLight);
}

// --- Hàm Tải Models ---
function loadModels() {
    const loader = new GLTFLoader();

    // Load Environment
    const environmentPath = '../public/models/environment/hub__beacon.glb'; // Sửa lại nếu cần
    loader.load(environmentPath, (gltf) => {
        const environmentModel = gltf.scene;
        environmentModel.position.set(0, 0, 0);
        environmentModel.scale.set(15, 15, 15);
        environmentModel.traverse((child) => { if (child.isMesh) child.receiveShadow = true; });
        scene.add(environmentModel);
        console.log(`Environment model loaded: ${environmentPath}`);
    }, (xhr) => console.log(`Loading environment: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`),
       (error) => console.error(`Error loading environment: ${environmentPath}`, error));

    // Load Character
    const characterPath = '../public/models/character/luoli_run.glb'; // Sửa lại nếu cần
    loader.load(characterPath, (gltf) => {
        characterModel = gltf.scene;
        characterModel.position.set(0, 1, 3); // Chỉnh vị trí Y cho khớp sàn
        characterModel.scale.set(0.01, 0.01, 0.01); // Chỉnh scale nếu cần
        characterModel.traverse((child) => { if (child.isMesh) child.castShadow = true; });
        scene.add(characterModel);
        console.log(`Character model loaded: ${characterPath}`);

        // Animation Handling
        if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(characterModel);
            console.log("Available character animations:");
            gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                animations[clip.name] = action;
                console.log("- ", clip.name);
                if (clip.name.toLowerCase().includes('jump')) {
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                }
            });
            const defaultAnimName = 'Idle';
            currentAction = animations[defaultAnimName];
            if (currentAction) {
                currentAction.play();
                console.log("Playing default animation:", currentAction.getClip().name);
            } else {
                // Fallback to first animation
                const firstKey = Object.keys(animations)[0];
                if(firstKey) {
                    currentAction = animations[firstKey];
                    currentAction.play();
                    console.warn(`Default animation '${defaultAnimName}' not found. Playing first available: ${firstKey}`);
                } else {
                    console.error("No animations found to play.");
                }
            }
        } else {
            console.warn("No animations found in character model.");
        }
    }, (xhr) => console.log(`Loading character: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`),
       (error) => console.error(`Error loading character: ${characterPath}`, error));
}


// --- Hàm Chuyển Animation ---
function playAnimation(name) {
    if (!mixer || !animations[name]) {
        // console.warn(`Animation "${name}" not found or mixer not ready!`); // Tạm ẩn để đỡ log nhiều
        return;
    }
    const newAction = animations[name];
    if (newAction !== currentAction) {
        // console.log(`Switching animation to: ${name}`); // Tạm ẩn
        if (currentAction) {
            currentAction.fadeOut(0.2);
        }
        newAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
        currentAction = newAction;
    }
}

// --- Input Listener (Test) ---
window.addEventListener('keydown', (event) => {
    // !! Thay tên animation cho đúng !!
    switch (event.key) {
        case '1': playAnimation('Idle'); break;
        case '2': playAnimation('Run'); break;
        case '3': playAnimation('Jump'); break;
    }
});

// --- Resize Listener ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // --- 10. Cập nhật OrbitControls ---
    // Cần gọi update nếu enableDamping = true hoặc có thay đổi tự động
    controls.update();

    // Cập nhật Animation Mixer
    if (mixer) {
        mixer.update(deltaTime);
    }

    // (Logic game khác nếu có)

    renderer.render(scene, camera);
}