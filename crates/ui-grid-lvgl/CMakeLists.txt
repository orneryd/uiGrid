cmake_minimum_required(VERSION 3.20)

project(ui_grid_lvgl LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

include(FetchContent)

set(
  UI_GRID_C_ABI_LIBRARY
  "${CMAKE_CURRENT_SOURCE_DIR}/../../target/debug/libui_grid_c_abi.a"
  CACHE FILEPATH
  "Path to the built ui-grid-c-abi static library"
)

set(CONFIG_LV_USE_SDL ON CACHE BOOL "Enable LVGL SDL backend" FORCE)
set(LV_BUILD_EXAMPLES OFF CACHE BOOL "Disable upstream LVGL examples" FORCE)
set(LV_BUILD_DEMOS OFF CACHE BOOL "Disable upstream LVGL demos" FORCE)
set(LV_USE_FIND_PACKAGE_SDL2 ON CACHE BOOL "Resolve SDL2 with find_package" FORCE)
set(LV_USE_PKG_CONFIG_SDL2 OFF CACHE BOOL "Disable pkg-config SDL2 lookup" FORCE)
set(LV_FETCH_SDL2 OFF CACHE BOOL "Do not fetch SDL2; use the local install" FORCE)

find_path(
  SDL2_INCLUDE_DIR
  SDL2/SDL.h
  HINTS
    /opt/homebrew/include
    /usr/local/include
  REQUIRED
)

find_library(
  SDL2_LIBRARY
  SDL2
  HINTS
    /opt/homebrew/lib
    /usr/local/lib
  REQUIRED
)

FetchContent_Declare(
  lvgl
  GIT_REPOSITORY https://github.com/lvgl/lvgl.git
  GIT_TAG v9.5.0
  GIT_SHALLOW TRUE
)

FetchContent_MakeAvailable(lvgl)

target_include_directories(lvgl SYSTEM PUBLIC ${SDL2_INCLUDE_DIR})
target_link_libraries(lvgl PUBLIC ${SDL2_LIBRARY})

add_library(ui_grid_lvgl STATIC
  src/ui_grid_lvgl_theme.c
  src/ui_grid_lvgl.c
)

target_include_directories(
  ui_grid_lvgl
  PUBLIC
    ${lvgl_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../ui-grid-c-abi/include
)

target_link_libraries(
  ui_grid_lvgl
  PUBLIC
    ${UI_GRID_C_ABI_LIBRARY}
    lvgl::lvgl
)

add_executable(ui-grid-lvgl-demo
  examples/demo/main.c
)

target_link_libraries(ui-grid-lvgl-demo PRIVATE ui_grid_lvgl)