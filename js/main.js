const gridSize = 8;
const grid = [];
const bombQueue = [];
let turn = 0;
let score = 0;
let gameOver = false;
let bombPower = 1; // 기본 폭파 범위
let bombDamage = 1; // 기본 폭파 데미지
let upgrading = false; // 업그레이드 선택 중 여부
const upgradeTurnNum = 10; // 업그레이드 턴 주기
let bestScore = 0;

function loadBestScore() {
  const saved = localStorage.getItem("bombBlockBestScore");
  bestScore = saved ? parseInt(saved) : 0;
}
function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("bombBlockBestScore", bestScore);
  }
}

function updateStatus() {
  $("#status").html(`
    <div class="bg-white rounded-md px-4 py-2 shadow-inner text-sm md:text-lg  font-mono flex flex-wrap justify-center gap-x-6 gap-y-2">

      <div class="flex items-center gap-1">
        <span class="text-gray-600">Turn</span>
        <span class="font-bold text-red-500">${turn}</span>
      </div>

      <div class="flex items-center gap-1">
        <span class="text-gray-600">Score</span>
        <span class="font-bold text-red-500">${score}</span>
      </div>

      <div class="flex items-center gap-1">
        <span class="text-gray-600">Best Score</span>
        <span class="font-bold text-red-500">${bestScore}</span>
      </div>

      <div class="flex items-center gap-1">
        <span class="text-gray-600">Range</span>
        <span class="font-bold text-yellow-500">${bombPower}</span>
      </div>

      <div class="flex items-center gap-1">
        <span class="text-gray-600">Damage</span>
        <span class="font-bold text-yellow-500">${bombDamage}</span>
      </div>
    </div>
  `);
}

function createGrid() {
  const $grid = $("#grid").empty();
  for (let y = 0; y < gridSize; y++) {
    grid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const $cell = $(
        `<div class="cell bg-white border border-black text-center flex items-center justify-center cursor-pointer" data-x="${x}" data-y="${y}"></div>`
      );
      grid[y][x] = { bomb: null, obstacle: null, el: $cell };
      $grid.append($cell);
    }
  }
}

function updateObstacleStyle(cell) {
  // Tailwind 클래스 정리
  cell.el.removeClass((_, c) => (c.match(/bg-gray-[0-9]{3}/g) || []).join(" "));
  if (!cell.obstacle) return;
  const level = 400 + Math.min(cell.obstacle - 1, 5) * 100;
  cell.el.addClass(`obstacle bg-gray-${level}`);
}

function placeRandomObstacles(count = 1) {
  let attempts = 0;
  while (count > 0 && attempts < 100) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    const cell = grid[y][x];
    if (!cell.bomb && !cell.obstacle) {
      cell.obstacle = 1;
      cell.el.text(1);
      updateObstacleStyle(cell);
      count--;
    } else if (cell.obstacle) {
      cell.obstacle++;
      cell.el.text(cell.obstacle);
      updateObstacleStyle(cell);
      count--;
    }
    attempts++;
  }
}

function placeBomb(x, y) {
  const cell = grid[y][x];
  if (!cell.bomb && !cell.obstacle) {
    const bomb = { x, y, countdown: 3, power: bombPower, damage: bombDamage };
    cell.bomb = bomb;
    bombQueue.push(bomb);
    cell.el.text("3").addClass("bomb");
  }
}

function showUpgradeOptions() {
  upgrading = true;
  const $upgradeArea = $("#upgrade-cards").empty().removeClass("hidden");
  $("#grid-dim").removeClass("hidden"); // 👉 딤 활성화

  const options = [
    {
      name: "Bomb Range +1",
      icon: "🧨",
      action: () => {
        bombPower += 1;
      },
    },
    {
      name: "Bomb Damage +1",
      icon: "💥",
      action: () => {
        bombDamage += 1;
      },
    },
  ];

  options.forEach((option) => {
    const $card = $(`
      <div class="bg-white shadow-lg rounded-lg p-6 m-2 cursor-pointer hover:bg-gray-200 flex flex-col items-center w-32">
        <div class="text-4xl mb-2">${option.icon}</div>
        <div class="font-bold text-sm">${option.name}</div>
      </div>
    `);

    $card.on("click", () => {
      option.action(); // bombPower 또는 bombDamage 올리기
      updateStatus(); // 👉 상태 갱신 즉시 해줘야 함
      $("#upgrade-cards").addClass("hidden").empty();
      $("#grid-dim").addClass("hidden");
      upgrading = false;
    });

    $upgradeArea.append($card);
  });
}

function updateTurn() {
  turn++;

  // 폭탄 카운트다운 감소 및 화면 업데이트
  bombQueue.forEach((bomb) => {
    bomb.countdown--;
    grid[bomb.y][bomb.x].el.text(bomb.countdown);
  });

  // 터질 폭탄 모으기
  const toExplode = bombQueue.filter((b) => b.countdown <= 0);
  const group = new Set();
  const queue = [...toExplode];

  while (queue.length > 0) {
    const b = queue.shift();
    const key = `${b.x},${b.y}`;
    if (group.has(key)) continue;

    group.add(key);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    dirs.forEach(([dx, dy]) => {
      for (let i = 1; i <= b.power; i++) {
        // power 만큼 확인
        const nx = b.x + dx * i;
        const ny = b.y + dy * i;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) break;

        const neighbor = grid[ny][nx].bomb;
        if (neighbor && neighbor.countdown > 0) {
          neighbor.countdown = 0;
          queue.push(neighbor);
        }

        if (grid[ny][nx].obstacle) {
          break; // 벽이 있으면 연쇄폭발 멈춤
        }
      }
    });
  }

  // 그룹 내 폭탄 실제 폭발
  const totalDamage = group.size;

  group.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const bomb = grid[y][x].bomb;
    if (bomb) {
      explodeUniformDamage(x, y, bomb.damage, bomb.power);
    } else {
      explodeUniformDamage(x, y, bombDamage, bombPower);
    }
    grid[y][x].bomb = null;
    grid[y][x].el.text("").removeClass("bomb");
  });

  // 폭탄 큐 정리
  bombQueue.splice(
    0,
    bombQueue.length,
    ...bombQueue.filter((b) => b.countdown > 0)
  );

  // 3턴마다 벽 생성
  if (turn % 3 === 0) {
    const newWallCount = Math.floor(turn / 3);
    placeRandomObstacles(newWallCount);
  }

  // 상태 업데이트
  updateStatus();
  checkGameOver();

  // n턴마다 업그레이드 카드 표시 (가장 마지막에)
  if (turn % upgradeTurnNum === 0) {
    showUpgradeOptions();
  }
}

function explodeUniformDamage(x, y, damage, power = 1) {
  showExplosion(x, y, damage);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  dirs.forEach(([dx, dy]) => {
    for (let i = 1; i <= power; i++) {
      // power 만큼 반복
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) break;

      const cell = grid[ny][nx];
      showExplosion(nx, ny, damage);

      if (cell.obstacle) {
        cell.obstacle -= damage;
        if (cell.obstacle <= 0) {
          score += 2;
          cell.obstacle = null;
          cell.el.text("").removeClass("obstacle");
        } else {
          score += 1;
          cell.el.text(cell.obstacle);
        }
        updateObstacleStyle(cell);
        break;
      }
    }
  });
}

function explodeBomb(bomb, toExplodeQueue) {
  const { x, y, power, damage } = bomb;
  const cell = grid[y][x];

  // 🧨 폭탄 제거
  cell.el.text("");
  cell.el.removeClass("bomb");
  cell.bomb = null;

  // 💥 폭탄 중심에 누적된 데미지 표시
  showExplosion(x, y, damage);

  // ➕ 폭발 범위 처리
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  dirs.forEach(([dx, dy]) => {
    for (let i = 1; i <= power; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) break;

      const target = grid[ny][nx];

      // 💥 데미지 표시
      showExplosion(nx, ny, damage);

      // 🧱 벽 처리
      if (target.obstacle) {
        target.obstacle -= damage;
        if (target.obstacle <= 0) {
          score += 2;
          target.obstacle = null;
          target.el.text("").removeClass("obstacle");
        } else {
          score += 1;
          target.el.text(target.obstacle);
        }
        updateObstacleStyle(target);
        break;
      }

      // 🔁 연쇄 폭발: damage 누적 전파
      if (target.bomb && target.bomb.countdown > 0) {
        target.bomb.countdown = 0;
        toExplodeQueue.push({
          ...target.bomb,
          damage: damage + target.bomb.damage, // 누적 damage
        });
      }
    }
  });
}

function showExplosion(x, y, damage = 1) {
  const cell = grid[y][x];
  cell.el.text(damage);
  cell.el.addClass("explode");

  cell.el.one("animationend", () => {
    if (!cell.bomb && !cell.obstacle) {
      cell.el.text("");
    }
    cell.el.removeClass("explode");
  });
}

function checkGameOver() {
  const hasEmpty = grid.flat().some((c) => !c.bomb && !c.obstacle);
  if (!hasEmpty) {
    gameOver = true;
    $("#overlay").removeClass("hidden");
  }
}

$("#grid").on("click", ".cell", function () {
  if (gameOver || upgrading) return; // 👉 업그레이드 중이면 클릭 무시

  const x = parseInt($(this).data("x"));
  const y = parseInt($(this).data("y"));
  const cell = grid[y][x];
  if (cell.bomb || cell.obstacle) return;

  placeBomb(x, y);
  saveBestScore(); // 👉 클릭하자마자 최고 점수 업데이트
  updateStatus(); // 👉 상태창 바로 갱신
  updateTurn();
});

createGrid();
placeRandomObstacles(10);
loadBestScore(); // 먼저 불러오고
updateStatus(); // 그리고 화면 반영
