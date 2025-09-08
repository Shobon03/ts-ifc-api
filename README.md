# ts-ifc-api

<p style="text-align: center;">
<strong>BIM Interoperability API, written in Typescript</strong>
</p>

## Goals

This project aims to add a layer of interoperability for BIM software, especially Revit and Archicad, by having an API, an interface and documentation.

## Executing locally

Clone this project:
```bash
git clone https://github.com/Shobon03/ts-ifc-api
cd ts-ifc-api/
```

Install dependencies:
```bash
npm i
```

Copy `.env.example` to `.env`:
```bash
cd backend && cp .env.example .env && cd ..
```

Execute the application:
```bash
npm run dev
```

Ports after initialization:

- http://localhost:3000 -> API
- http://localhost:3001 -> Frontend
- http://localhost:3002 -> Documentation

## License

This project is licensed under GPL-3.0 - see [LICENSE](LICENSE) for more details.

## About

This project is a part of my final thesis for my undergraduate Computer Science degree.