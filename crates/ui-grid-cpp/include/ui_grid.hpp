#ifndef UI_GRID_HPP
#define UI_GRID_HPP

#include <map>
#include <optional>
#include <stdexcept>
#include <cstdint>
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>
#include <utility>

#include "ui_grid_c_abi.h"

namespace ui_grid {

namespace detail {

inline std::string escape_json(std::string_view value) {
    std::string escaped;
    escaped.reserve(value.size() + 8);

    for (char ch : value) {
        switch (ch) {
            case '"':
                escaped += "\\\"";
                break;
            case '\\':
                escaped += "\\\\";
                break;
            case '\b':
                escaped += "\\b";
                break;
            case '\f':
                escaped += "\\f";
                break;
            case '\n':
                escaped += "\\n";
                break;
            case '\r':
                escaped += "\\r";
                break;
            case '\t':
                escaped += "\\t";
                break;
            default:
                escaped.push_back(ch);
                break;
        }
    }

    return escaped;
}

inline std::string json_string(std::string_view value) {
    return std::string("\"") + escape_json(value) + "\"";
}

inline void skip_json_whitespace(std::string_view value, std::size_t &index) {
    while (index < value.size()) {
        const char ch = value[index];
        if (ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t') {
            ++index;
            continue;
        }
        break;
    }
}

inline void expect_json_char(std::string_view value, std::size_t &index, char expected) {
    skip_json_whitespace(value, index);
    if (index >= value.size() || value[index] != expected) {
        throw std::runtime_error("unexpected JSON shape in projection envelope");
    }
    ++index;
}

inline std::string parse_json_string(std::string_view value, std::size_t &index) {
    skip_json_whitespace(value, index);
    if (index >= value.size() || value[index] != '"') {
        throw std::runtime_error("expected JSON string in projection envelope");
    }

    ++index;
    std::string result;
    while (index < value.size()) {
        const char ch = value[index++];
        if (ch == '"') {
            return result;
        }
        if (ch != '\\') {
            result.push_back(ch);
            continue;
        }
        if (index >= value.size()) {
            throw std::runtime_error("unterminated JSON escape in projection envelope");
        }
        const char escaped = value[index++];
        switch (escaped) {
            case '"':
            case '\\':
            case '/':
                result.push_back(escaped);
                break;
            case 'b':
                result.push_back('\b');
                break;
            case 'f':
                result.push_back('\f');
                break;
            case 'n':
                result.push_back('\n');
                break;
            case 'r':
                result.push_back('\r');
                break;
            case 't':
                result.push_back('\t');
                break;
            default:
                throw std::runtime_error("unsupported JSON escape in projection envelope");
        }
    }

    throw std::runtime_error("unterminated JSON string in projection envelope");
}

inline std::string_view parse_json_value_slice(std::string_view value, std::size_t &index) {
    skip_json_whitespace(value, index);
    const std::size_t start = index;
    if (index >= value.size()) {
        throw std::runtime_error("missing JSON value in projection envelope");
    }

    if (value[index] == '"') {
        parse_json_string(value, index);
        return value.substr(start, index - start);
    }

    if (value[index] == '{' || value[index] == '[') {
        const char open = value[index++];
        const char close = open == '{' ? '}' : ']';
        int depth = 1;
        bool in_string = false;
        while (index < value.size()) {
            const char ch = value[index++];
            if (in_string) {
                if (ch == '\\') {
                    ++index;
                    continue;
                }
                if (ch == '"') {
                    in_string = false;
                }
                continue;
            }
            if (ch == '"') {
                in_string = true;
                continue;
            }
            if (ch == open) {
                ++depth;
                continue;
            }
            if (ch == close) {
                --depth;
                if (depth == 0) {
                    return value.substr(start, index - start);
                }
            }
        }

        throw std::runtime_error("unterminated JSON container in projection envelope");
    }

    while (index < value.size()) {
        const char ch = value[index];
        if (ch == ',' || ch == '}' || ch == ']') {
            break;
        }
        ++index;
    }
    return value.substr(start, index - start);
}

inline std::uint8_t read_msgpack_u8(const std::vector<std::uint8_t> &bytes, std::size_t &index) {
    if (index >= bytes.size()) {
        throw std::runtime_error("unexpected end of MessagePack envelope");
    }
    return bytes[index++];
}

inline std::uint16_t read_msgpack_u16(const std::vector<std::uint8_t> &bytes, std::size_t &index) {
    const auto first = static_cast<std::uint16_t>(read_msgpack_u8(bytes, index));
    const auto second = static_cast<std::uint16_t>(read_msgpack_u8(bytes, index));
    return static_cast<std::uint16_t>((first << 8U) | second);
}

inline std::uint32_t read_msgpack_u32(const std::vector<std::uint8_t> &bytes, std::size_t &index) {
    const auto first = static_cast<std::uint32_t>(read_msgpack_u16(bytes, index));
    const auto second = static_cast<std::uint32_t>(read_msgpack_u16(bytes, index));
    return (first << 16U) | second;
}

inline void skip_msgpack_bytes(const std::vector<std::uint8_t> &bytes, std::size_t &index, std::size_t len) {
    if (index + len > bytes.size()) {
        throw std::runtime_error("unexpected end of MessagePack payload");
    }
    index += len;
}

inline std::size_t read_msgpack_string_length(
    const std::vector<std::uint8_t> &bytes,
    std::size_t &index,
    std::uint8_t marker
) {
    if ((marker & 0xe0U) == 0xa0U) {
        return marker & 0x1fU;
    }
    switch (marker) {
        case 0xd9:
            return read_msgpack_u8(bytes, index);
        case 0xda:
            return read_msgpack_u16(bytes, index);
        case 0xdb:
            return read_msgpack_u32(bytes, index);
        default:
            throw std::runtime_error("expected MessagePack string in projection envelope");
    }
}

inline std::string parse_msgpack_string(const std::vector<std::uint8_t> &bytes, std::size_t &index) {
    const auto marker = read_msgpack_u8(bytes, index);
    const auto len = read_msgpack_string_length(bytes, index, marker);
    if (index + len > bytes.size()) {
        throw std::runtime_error("unexpected end of MessagePack string in projection envelope");
    }
    std::string value(bytes.begin() + static_cast<std::ptrdiff_t>(index), bytes.begin() + static_cast<std::ptrdiff_t>(index + len));
    index += len;
    return value;
}

inline std::size_t read_msgpack_map_length(
    const std::vector<std::uint8_t> &bytes,
    std::size_t &index,
    std::uint8_t marker
) {
    if ((marker & 0xf0U) == 0x80U) {
        return marker & 0x0fU;
    }
    switch (marker) {
        case 0xde:
            return read_msgpack_u16(bytes, index);
        case 0xdf:
            return read_msgpack_u32(bytes, index);
        default:
            throw std::runtime_error("expected MessagePack map in projection envelope");
    }
}

inline std::size_t read_msgpack_array_length(
    const std::vector<std::uint8_t> &bytes,
    std::size_t &index,
    std::uint8_t marker
) {
    if ((marker & 0xf0U) == 0x90U) {
        return marker & 0x0fU;
    }
    switch (marker) {
        case 0xdc:
            return read_msgpack_u16(bytes, index);
        case 0xdd:
            return read_msgpack_u32(bytes, index);
        default:
            throw std::runtime_error("expected MessagePack array in projection envelope");
    }
}

inline void skip_msgpack_value(const std::vector<std::uint8_t> &bytes, std::size_t &index) {
    const auto marker = read_msgpack_u8(bytes, index);

    if (marker <= 0x7fU || marker >= 0xe0U) {
        return;
    }
    if ((marker & 0xe0U) == 0xa0U) {
        skip_msgpack_bytes(bytes, index, marker & 0x1fU);
        return;
    }
    if ((marker & 0xf0U) == 0x90U) {
        const auto len = marker & 0x0fU;
        for (std::size_t i = 0; i < len; ++i) {
            skip_msgpack_value(bytes, index);
        }
        return;
    }
    if ((marker & 0xf0U) == 0x80U) {
        const auto len = marker & 0x0fU;
        for (std::size_t i = 0; i < len; ++i) {
            skip_msgpack_value(bytes, index);
            skip_msgpack_value(bytes, index);
        }
        return;
    }

    switch (marker) {
        case 0xc0:
        case 0xc2:
        case 0xc3:
            return;
        case 0xcc:
        case 0xd0:
            skip_msgpack_bytes(bytes, index, 1);
            return;
        case 0xcd:
        case 0xd1:
            skip_msgpack_bytes(bytes, index, 2);
            return;
        case 0xce:
        case 0xd2:
        case 0xca:
            skip_msgpack_bytes(bytes, index, 4);
            return;
        case 0xcf:
        case 0xd3:
        case 0xcb:
            skip_msgpack_bytes(bytes, index, 8);
            return;
        case 0xd9:
            skip_msgpack_bytes(bytes, index, read_msgpack_u8(bytes, index));
            return;
        case 0xda:
            skip_msgpack_bytes(bytes, index, read_msgpack_u16(bytes, index));
            return;
        case 0xdb:
            skip_msgpack_bytes(bytes, index, read_msgpack_u32(bytes, index));
            return;
        case 0xc4:
            skip_msgpack_bytes(bytes, index, read_msgpack_u8(bytes, index));
            return;
        case 0xc5:
            skip_msgpack_bytes(bytes, index, read_msgpack_u16(bytes, index));
            return;
        case 0xc6:
            skip_msgpack_bytes(bytes, index, read_msgpack_u32(bytes, index));
            return;
        case 0xdc: {
            const auto len = read_msgpack_u16(bytes, index);
            for (std::size_t i = 0; i < len; ++i) {
                skip_msgpack_value(bytes, index);
            }
            return;
        }
        case 0xdd: {
            const auto len = read_msgpack_u32(bytes, index);
            for (std::size_t i = 0; i < len; ++i) {
                skip_msgpack_value(bytes, index);
            }
            return;
        }
        case 0xde: {
            const auto len = read_msgpack_u16(bytes, index);
            for (std::size_t i = 0; i < len; ++i) {
                skip_msgpack_value(bytes, index);
                skip_msgpack_value(bytes, index);
            }
            return;
        }
        case 0xdf: {
            const auto len = read_msgpack_u32(bytes, index);
            for (std::size_t i = 0; i < len; ++i) {
                skip_msgpack_value(bytes, index);
                skip_msgpack_value(bytes, index);
            }
            return;
        }
        default:
            throw std::runtime_error("unsupported MessagePack token in projection envelope");
    }
}

}  // namespace detail

enum class SortDirection {
    none,
    asc,
    desc,
};

inline std::string to_json_sort_direction(SortDirection direction) {
    switch (direction) {
        case SortDirection::none:
            return "none";
        case SortDirection::asc:
            return "asc";
        case SortDirection::desc:
            return "desc";
    }

    throw std::runtime_error("unsupported SortDirection value");
}

enum class PinTarget {
    left,
    center,
    right,
};

inline std::string to_json_pin_target(PinTarget target) {
    switch (target) {
        case PinTarget::left:
            return "left";
        case PinTarget::center:
            return "center";
        case PinTarget::right:
            return "right";
    }

    throw std::runtime_error("unsupported PinTarget value");
}

enum class Codec : std::uint32_t {
    json = UI_GRID_CODEC_JSON,
    message_pack = UI_GRID_CODEC_MESSAGE_PACK,
};

struct ProjectionEnvelopeJson {
    std::string engine_contract_version;
    std::string c_abi_version;
    std::string projection_schema_version;
    std::string command_schema_version;
    std::string payload_json;

    static ProjectionEnvelopeJson parse(std::string_view json) {
        ProjectionEnvelopeJson envelope;
        std::size_t index = 0;

        detail::expect_json_char(json, index, '{');
        while (true) {
            detail::skip_json_whitespace(json, index);
            if (index >= json.size()) {
                throw std::runtime_error("unterminated projection envelope JSON");
            }
            if (json[index] == '}') {
                ++index;
                break;
            }

            const std::string key = detail::parse_json_string(json, index);
            detail::expect_json_char(json, index, ':');
            const std::string_view value = detail::parse_json_value_slice(json, index);

            if (key == "engineContractVersion") {
                std::size_t value_index = 0;
                envelope.engine_contract_version = detail::parse_json_string(value, value_index);
            } else if (key == "cAbiVersion") {
                std::size_t value_index = 0;
                envelope.c_abi_version = detail::parse_json_string(value, value_index);
            } else if (key == "projectionSchemaVersion") {
                std::size_t value_index = 0;
                envelope.projection_schema_version = detail::parse_json_string(value, value_index);
            } else if (key == "commandSchemaVersion") {
                std::size_t value_index = 0;
                envelope.command_schema_version = detail::parse_json_string(value, value_index);
            } else if (key == "payload") {
                envelope.payload_json.assign(value.begin(), value.end());
            }

            detail::skip_json_whitespace(json, index);
            if (index < json.size() && json[index] == ',') {
                ++index;
                continue;
            }
            if (index < json.size() && json[index] == '}') {
                ++index;
                break;
            }
        }

        if (envelope.engine_contract_version.empty() || envelope.payload_json.empty()) {
            throw std::runtime_error("projection envelope JSON is missing required fields");
        }

        return envelope;
    }
};

struct ProjectionEnvelopeMessagePack {
    std::string engine_contract_version;
    std::string c_abi_version;
    std::string projection_schema_version;
    std::string command_schema_version;
    std::vector<std::uint8_t> payload_bytes;

    static ProjectionEnvelopeMessagePack parse(const std::vector<std::uint8_t> &bytes) {
        ProjectionEnvelopeMessagePack envelope;
        std::size_t index = 0;
        const auto marker = detail::read_msgpack_u8(bytes, index);
        const auto entry_count = detail::read_msgpack_map_length(bytes, index, marker);

        for (std::size_t entry_index = 0; entry_index < entry_count; ++entry_index) {
            const auto key = detail::parse_msgpack_string(bytes, index);
            if (key == "engineContractVersion") {
                envelope.engine_contract_version = detail::parse_msgpack_string(bytes, index);
            } else if (key == "cAbiVersion") {
                envelope.c_abi_version = detail::parse_msgpack_string(bytes, index);
            } else if (key == "projectionSchemaVersion") {
                envelope.projection_schema_version = detail::parse_msgpack_string(bytes, index);
            } else if (key == "commandSchemaVersion") {
                envelope.command_schema_version = detail::parse_msgpack_string(bytes, index);
            } else if (key == "payload") {
                const auto payload_start = index;
                detail::skip_msgpack_value(bytes, index);
                envelope.payload_bytes.assign(
                    bytes.begin() + static_cast<std::ptrdiff_t>(payload_start),
                    bytes.begin() + static_cast<std::ptrdiff_t>(index)
                );
            } else {
                detail::skip_msgpack_value(bytes, index);
            }
        }

        if (envelope.engine_contract_version.empty() || envelope.payload_bytes.empty()) {
            throw std::runtime_error("projection envelope MessagePack is missing required fields");
        }

        return envelope;
    }
};

struct SortCommand {
    std::optional<std::string> column_name;
    SortDirection direction = SortDirection::none;

    std::string to_json() const {
        std::string json = "{\"kind\":\"setSort\",\"columnName\":";
        json += column_name.has_value() ? detail::json_string(*column_name) : "null";
        json += ",\"direction\":";
        json += detail::json_string(to_json_sort_direction(direction));
        json += "}";
        return json;
    }
};

struct GroupingCommand {
    std::vector<std::string> group_by;

    std::string to_json() const {
        std::string json = "{\"kind\":\"setGrouping\",\"groupBy\":[";
        for (std::size_t index = 0; index < group_by.size(); ++index) {
            if (index > 0) {
                json += ",";
            }
            json += detail::json_string(group_by[index]);
        }
        json += "]}";
        return json;
    }
};

struct PinColumnsCommand {
    std::map<std::string, PinTarget> pinned_columns;

    std::string to_json() const {
        std::string json = "{\"kind\":\"setPinnedColumns\",\"pinnedColumns\":{";
        bool first = true;
        for (const auto &[column_name, target] : pinned_columns) {
            if (!first) {
                json += ",";
            }
            first = false;
            json += detail::json_string(column_name);
            json += ":";
            json += detail::json_string(to_json_pin_target(target));
        }
        json += "}}";
        return json;
    }
};

class Engine {
public:
    Engine() : handle_(ui_grid_engine_create()) {
        if (handle_ == nullptr) {
            throw std::runtime_error("ui_grid_engine_create returned null");
        }
    }

    ~Engine() {
        if (handle_ != nullptr) {
            ui_grid_engine_destroy(handle_);
        }
    }

    Engine(const Engine &) = delete;
    Engine &operator=(const Engine &) = delete;

    Engine(Engine &&other) noexcept : handle_(std::exchange(other.handle_, nullptr)) {}

    Engine &operator=(Engine &&other) noexcept {
        if (this != &other) {
            if (handle_ != nullptr) {
                ui_grid_engine_destroy(handle_);
            }
            handle_ = std::exchange(other.handle_, nullptr);
        }
        return *this;
    }

    static std::string abi_version() {
        return take_string(ui_grid_abi_version());
    }

    static std::string projection_schema_version() {
        return take_string(ui_grid_projection_schema_version());
    }

    static std::string command_schema_version() {
        return take_string(ui_grid_command_schema_version());
    }

    void set_options_json(const std::string &json) {
        set_options_bytes(Codec::json, reinterpret_cast<const std::uint8_t *>(json.data()), json.size());
    }

    void set_rows_json(const std::string &json) {
        set_rows_bytes(Codec::json, reinterpret_cast<const std::uint8_t *>(json.data()), json.size());
    }

    void apply_command_json(const std::string &json) {
        apply_command_bytes(Codec::json, reinterpret_cast<const std::uint8_t *>(json.data()), json.size());
    }

    void set_options_bytes(Codec codec, const std::uint8_t *bytes, std::size_t len) {
        require_success(ui_grid_engine_set_options_bytes(handle_, static_cast<std::uint32_t>(codec), bytes, len));
    }

    void set_rows_bytes(Codec codec, const std::uint8_t *bytes, std::size_t len) {
        require_success(ui_grid_engine_set_rows_bytes(handle_, static_cast<std::uint32_t>(codec), bytes, len));
    }

    void apply_command_bytes(Codec codec, const std::uint8_t *bytes, std::size_t len) {
        require_success(ui_grid_engine_apply_command_bytes(handle_, static_cast<std::uint32_t>(codec), bytes, len));
    }

    void apply_sort(const SortCommand &command) {
        apply_command_json(command.to_json());
    }

    void apply_grouping(const GroupingCommand &command) {
        apply_command_json(command.to_json());
    }

    void apply_pinning(const PinColumnsCommand &command) {
        apply_command_json(command.to_json());
    }

    std::string projection_json() {
        auto bytes = projection_bytes(Codec::json);
        return std::string(bytes.begin(), bytes.end());
    }

    ProjectionEnvelopeJson projection_envelope_json() {
        return ProjectionEnvelopeJson::parse(projection_json());
    }

    ProjectionEnvelopeMessagePack projection_envelope_message_pack() {
        return ProjectionEnvelopeMessagePack::parse(projection_bytes(Codec::message_pack));
    }

    std::string save_state_json() {
        auto bytes = save_state_bytes(Codec::json);
        return std::string(bytes.begin(), bytes.end());
    }

    void restore_state_json(const std::string &json) {
        restore_state_bytes(Codec::json, reinterpret_cast<const std::uint8_t *>(json.data()), json.size());
    }

    std::vector<std::uint8_t> projection_bytes(Codec codec) {
        std::size_t len = 0;
        auto *value = ui_grid_engine_get_projection_bytes(handle_, static_cast<std::uint32_t>(codec), &len);
        return take_bytes_or_throw(value, len);
    }

    std::vector<std::uint8_t> save_state_bytes(Codec codec) {
        std::size_t len = 0;
        auto *value = ui_grid_engine_save_state_bytes(handle_, static_cast<std::uint32_t>(codec), &len);
        return take_bytes_or_throw(value, len);
    }

    void restore_state_bytes(Codec codec, const std::uint8_t *bytes, std::size_t len) {
        require_success(ui_grid_engine_restore_state_bytes(handle_, static_cast<std::uint32_t>(codec), bytes, len));
    }

    std::string last_error() const {
        return take_optional_string(ui_grid_engine_last_error_message(handle_));
    }

private:
    UiGridAbiEngine *handle_;

    void require_success(bool success) {
        if (!success) {
            std::string error = last_error();
            if (error.empty()) {
                error = "ui-grid ABI call failed";
            }
            throw std::runtime_error(error);
        }
    }

    static std::string take_string_or_throw(char *value) {
        if (value == nullptr) {
            throw std::runtime_error("ui-grid ABI returned a null string");
        }
        return take_string(value);
    }

    static std::string take_optional_string(char *value) {
        if (value == nullptr) {
            return std::string();
        }
        return take_string(value);
    }

    static std::vector<std::uint8_t> take_bytes_or_throw(std::uint8_t *value, std::size_t len) {
        if (value == nullptr) {
            throw std::runtime_error("ui-grid ABI returned a null buffer");
        }
        return take_bytes(value, len);
    }

    static std::vector<std::uint8_t> take_bytes(std::uint8_t *value, std::size_t len) {
        std::vector<std::uint8_t> owned(value, value + len);
        ui_grid_buffer_free(value, len);
        return owned;
    }

    static std::string take_string(char *value) {
        std::string owned(value);
        ui_grid_string_free(value);
        return owned;
    }
};

}  // namespace ui_grid

#endif