#!/bin/bash

echo "🚀 Canvas AI - Next.js Setup Script"
echo "========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy environment file if not exists
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your configuration values"
else
    echo "✅ .env.local already exists"
fi

# Generate NextAuth secret if not set
if ! grep -q "NEXTAUTH_SECRET=" .env.local || grep -q "NEXTAUTH_SECRET=$" .env.local; then
    echo ""
    echo "🔐 Generating NEXTAUTH_SECRET..."
    SECRET=$(openssl rand -base64 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$SECRET/" .env.local
    else
        sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$SECRET/" .env.local
    fi
    echo "✅ NEXTAUTH_SECRET generated and saved"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your configuration:"
echo "   - DATABASE_URL"
echo "   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "   - OPENAI_API_KEY"
echo "   - Other API keys as needed"
echo ""
echo "2. Set up the database:"
echo "   npm run db:push"
echo ""
echo "3. Start the development server:"
echo "   npm run dev"
echo ""
echo "Happy coding! 🎉"