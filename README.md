# BoxChooser

Intelligent box selection and packing optimization for shipping operations. Multi-store support, role-based access, and smart recommendations.

## Quick Start

```bash
# Run with Docker
docker compose up

# Create your first store
./tools/auth create 100 admin@example.com

# Open http://localhost:5893
```

Try the demo at http://localhost:5893/login → Demo tab

## Key Documentation

- [Installation Guide](docs/01-installation.md) - Full setup instructions
- [Store Configuration](docs/03-store-configuration.md) - Box inventory setup
- [Architecture Overview](docs/04-architecture.md) - Technical design
- [API Reference](docs/10-api-reference.md) - Endpoint documentation
- [Development Guide](docs/11-development-guide.md) - Contributing & testing

See all docs in the [`/docs`](docs/) directory.

## Features

- 📦 Smart box recommendations based on item dimensions
- 🔒 Two-tier authentication (PIN for staff, email for admins)
- 🏪 Multi-store isolation with separate inventories
- 💰 Flexible box pricing (standard or itemized with materials/labor)
- 📊 Excel import/export for bulk updates
- 🖨️ Thermal label printing

## License

MIT - See [LICENSE](LICENSE)

**Important**: See [DISCLAIMER.md](DISCLAIMER.md) for liability limitations.

## Acknowledgments

Built on [navigator9951's original PackingWebsite](https://github.com/navigator9951/PackingWebsite). The core packing algorithms remain the heart of this system.

---

Questions? Open an [issue](https://github.com/km1tch/BoxChooser/issues) or see the [documentation](docs/).
