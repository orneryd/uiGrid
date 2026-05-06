cmake_minimum_required(VERSION 3.20)

project(ui_grid_cpp_smoke LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(
  UI_GRID_C_ABI_LIBRARY
  "${CMAKE_CURRENT_SOURCE_DIR}/../../target/debug/libui_grid_c_abi.a"
  CACHE FILEPATH
  "Path to the built ui-grid-c-abi static library"
)

add_library(ui_grid_c_abi STATIC IMPORTED GLOBAL)
set_target_properties(
  ui_grid_c_abi
  PROPERTIES
    IMPORTED_LOCATION "${UI_GRID_C_ABI_LIBRARY}"
)

add_executable(ui-grid-cpp-smoke examples/smoke.cpp)
target_include_directories(
  ui-grid-cpp-smoke
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../ui-grid-c-abi/include
)
target_link_libraries(ui-grid-cpp-smoke PRIVATE ui_grid_c_abi)