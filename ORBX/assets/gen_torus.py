import math

# Torus parameters
R = 0.5   # major radius (center of tube to center of torus)
r = 0.15  # minor radius (tube radius)
N = 48    # segments around the ring
n = 24    # segments around the tube

vertices = []
normals = []
faces = []

for i in range(N):
    theta = 2 * math.pi * i / N
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    for j in range(n):
        phi = 2 * math.pi * j / n
        cos_p = math.cos(phi)
        sin_p = math.sin(phi)
        
        x = (R + r * cos_p) * cos_t
        y = r * sin_p
        z = (R + r * cos_p) * sin_t
        vertices.append((x, y, z))
        
        nx = cos_p * cos_t
        ny = sin_p
        nz = cos_p * sin_t
        normals.append((nx, ny, nz))

for i in range(N):
    for j in range(n):
        v1 = i * n + j + 1
        v2 = i * n + (j + 1) % n + 1
        v3 = ((i + 1) % N) * n + (j + 1) % n + 1
        v4 = ((i + 1) % N) * n + j + 1
        faces.append((v1, v2, v3, v4))

with open(r'C:\otoyla\GRPC\dev\octaneWebR\ORBX\assets\torus.obj', 'w') as f:
    f.write('# Torus R=0.5 r=0.15 48x24\n')
    for v in vertices:
        f.write(f'v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
    for n in normals:
        f.write(f'vn {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}\n')
    for face in faces:
        f.write(f'f {face[0]}//{face[0]} {face[1]}//{face[1]} {face[2]}//{face[2]} {face[3]}//{face[3]}\n')

print(f"Generated torus.obj: {len(vertices)} vertices, {len(faces)} faces")
