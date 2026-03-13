// Node.js 18+ compatibility hack
if (!globalThis.ReadableStream) {
  const { ReadableStream } = require('stream/web');
  globalThis.ReadableStream = ReadableStream;
}
if (!globalThis.File) {
  globalThis.File = class File extends Blob {
    constructor(bits, name, options = {}) {
      super(bits, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');
const fs = require('fs');
const path = require('path');

// ===== CONFIG =====
const TOKEN = process.env.TOKEN; // Get token from Railway Variables
const OWNER_ID = process.env.OWNER_ID; // Get owner ID from Railway Variables
const PREFIX = "-";
const startTime = Date.now();

// ===== DATA STORAGE =====
const dataPath = path.join(__dirname, 'selfbot_data.json');
let superReactUsers = new Set();
let autoReactUsers = new Map();

// Load existing data
if (fs.existsSync(dataPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        superReactUsers = new Set(data.superReactUsers || []);
        const loadedAutoReact = data.autoReactUsers || {};
        autoReactUsers = new Map(Object.entries(loadedAutoReact));
    } catch (e) {}
}

function saveData() {
    fs.writeFileSync(dataPath, JSON.stringify({
        superReactUsers: Array.from(superReactUsers),
        autoReactUsers: Object.fromEntries(autoReactUsers)
    }, null, 2));
}

// ===== CLIENT SETUP =====
const client = new Client({ checkUpdate: false });

// ===== READY EVENT =====
client.on('ready', () => {
    console.log(`✅ SELFBOT LOGGED IN: ${client.user.tag}`);
    console.log(`🆔 USER ID: ${client.user.id}`);
    console.log(`👑 OWNER ID: ${OWNER_ID}`);
    console.log(`🔥 SUPER REACT USERS: ${superReactUsers.size}`);
    console.log(`🎯 AUTO REACT USERS: ${autoReactUsers.size}`);
    console.log(`📊 SERVERS: ${client.guilds.cache.size}`);
    
    // Set status
    client.user.setActivity("optimized", { type: "PLAYING" });
});

// ===== MESSAGE EVENT =====
client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;
    
    // Super Reaction System
    if (superReactUsers.has(message.author.id)) {
        message.react('🔥').catch(() => {});
        message.react('💀').catch(() => {});
        message.react('👀').catch(() => {});
        message.react('😈').catch(() => {});
        return;
    }
    
    // Custom Auto React System
    const userReactions = autoReactUsers.get(message.author.id);
    if (userReactions) {
        for (const emoji of userReactions) {
            message.react(emoji).catch(() => {});
        }
        return;
    }
    
    // Command Handler (Owner Only)
    if (message.author.id !== OWNER_ID) return;
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    message.delete().catch(() => {}); // Delete command message
    
    let responseMsg = null;
    
    try {
        switch (command) {
            case 'ping':
                responseMsg = await message.channel.send(`${client.ws.ping}ms`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
                
            case 'uptime': {
                const uptime = Date.now() - startTime;
                const days = Math.floor(uptime / 86400000);
                const hours = Math.floor((uptime % 86400000) / 3600000);
                const minutes = Math.floor((uptime % 3600000) / 60000);
                const seconds = Math.floor((uptime % 60000) / 1000);
                const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                responseMsg = await message.channel.send(uptimeStr);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                break;
            }
                
            case 'srar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -srar <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = null;
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    targetUser = await client.users.fetch(args[0]).catch(() => null);
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                superReactUsers.add(targetUser.id);
                saveData();
                responseMsg = await message.channel.send(`Super reaction enabled for ${targetUser.tag}`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
                
            case 'unsr': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unsr <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = null;
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    targetUser = await client.users.fetch(args[0]).catch(() => null);
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                if (superReactUsers.has(targetUser.id)) {
                    superReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`Super reaction disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`${targetUser.tag} is not in super react list`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
                
            case 'ar': {
                if (args.length < 2) {
                    responseMsg = await message.channel.send('Usage: -ar <user> <emoji1> [emoji2] [emoji3] [emoji4]');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                    break;
                }
                
                let targetUser = null;
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                    args.shift();
                } else {
                    targetUser = await client.users.fetch(args[0]).catch(() => null);
                    args.shift();
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                const emojis = args.slice(0, 4);
                autoReactUsers.set(targetUser.id, emojis);
                saveData();
                responseMsg = await message.channel.send(`Auto-react set for ${targetUser.tag}: ${emojis.join(' ')}`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                break;
            }
                
            case 'unar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unar <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = null;
                if (message.mentions.users.size > 0) {
                    targetUser = message.mentions.users.first();
                } else {
                    targetUser = await client.users.fetch(args[0]).catch(() => null);
                }
                
                if (!targetUser) {
                    responseMsg = await message.channel.send('User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                if (autoReactUsers.has(targetUser.id)) {
                    autoReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`Auto-react disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`No auto-react set for ${targetUser.tag}`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
                
            case 'help': {
                const helpText = [
                    '**SELFBOT COMMANDS**',
                    '',
                    '`-ping` - Show latency',
                    '`-uptime` - Show uptime',
                    '`-srar <user>` - Add super react',
                    '`-unsr <user>` - Remove super react',
                    '`-ar <user> <emoji1> [emoji2-4]` - Set auto-react',
                    '`-unar <user>` - Remove auto-react'
                ].join('\n');
                responseMsg = await message.channel.send(helpText);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 10000);
                break;
            }
        }
    } catch (error) {
        console.error('Command error:', error);
    }
});

// ===== LOGIN =====
client.login(TOKEN).catch(error => {
    console.error('❌ Failed to login:', error.message);
    process.exit(1);
});

