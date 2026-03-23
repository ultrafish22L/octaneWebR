{
  "targets": [
    {
      "target_name": "dx_shared_surface",
      "sources": ["src/dx_shared_surface.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "libraries": ["-ld3d11", "-ldxgi"],
          "defines": ["WIN32_LEAN_AND_MEAN", "NOMINMAX"]
        }]
      ]
    }
  ]
}
