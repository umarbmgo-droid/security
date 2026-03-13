// Node.js compatibility hack - DO THIS FIRST
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

// ===== IMPORTS - ONLY ONCE! =====
const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const PREFIX = "-";
const startTime = Date.now();

// Check required env vars
if (!TOKEN) {
    console.error('❌ TOKEN environment variable not set!');
    process.exit(1);
}
if (!OWNER_ID) {
    console.error('❌ OWNER_ID environment variable not set!');
    process.exit(1);
}

// ===== DATA STORAGE =====
const dataPath = path.join(__dirname, 'selfbot_data.json');
let superReactUsers = new Set();
let autoReactUsers = new Map();
let admins = new Set();

// Load existing data
if (fs.existsSync(dataPath)) {
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        superReactUsers = new Set(data.superReactUsers || []);
        const loadedAutoReact = data.autoReactUsers || {};
        autoReactUsers = new Map(Object.entries(loadedAutoReact));
        admins = new Set(data.admins || []);
    } catch (e) {
        console.error('Failed to load data:', e.message);
    }
}

function saveData() {
    try {
        fs.writeFileSync(dataPath, JSON.stringify({
            superReactUsers: Array.from(superReactUsers),
            autoReactUsers: Object.fromEntries(autoReactUsers),
            admins: Array.from(admins)
        }, null, 2));
    } catch (e) {
        console.error('Failed to save data:', e.message);
    }
}

// ===== CLIENT SETUP =====
const client = new Client({ checkUpdate: false });

// ===== HELPER FUNCTIONS =====
function isOwnerOrAdmin(userId) {
    return userId === OWNER_ID || admins.has(userId);
}

// ===== READY EVENT =====
client.on('ready', () => {
    console.log('='.repeat(50));
    console.log(`✅ SELFBOT LOGGED IN: ${client.user.tag}`);
    console.log(`🆔 USER ID: ${client.user.id}`);
    console.log(`👑 OWNER ID: ${OWNER_ID}`);
    console.log(`🔥 SUPER REACT USERS: ${superReactUsers.size}`);
    console.log(`🎯 AUTO REACT USERS: ${autoReactUsers.size}`);
    console.log(`👥 ADMINS: ${admins.size}`);
    console.log(`📊 SERVERS: ${client.guilds.cache.size}`);
    console.log('='.repeat(50));
    
    client.user.setActivity("optimized", { type: "PLAYING" });
});

// ===== MESSAGE EVENT =====
client.on('messageCreate', async (message) => {
    // Ignore own messages
    if (message.author.id === client.user.id) return;
    
    // SUPER REACTION SYSTEM - auto-react with 4 emojis
    if (superReactUsers.has(message.author.id)) {
        try { await message.react('🔥'); } catch (e) {}
        try { await message.react('💀'); } catch (e) {}
        try { await message.react('👀'); } catch (e) {}
        try { await message.react('😈'); } catch (e) {}
        return; // Don't process commands for super reacted users
    }
    
    // CUSTOM AUTO REACT SYSTEM
    const userReactions = autoReactUsers.get(message.author.id);
    if (userReactions && userReactions.length > 0) {
        for (const emoji of userReactions) {
            try { await message.react(emoji); } catch (e) {}
        }
        return; // Don't process commands for auto reacted users
    }
    
    // COMMAND HANDLER - Only owner or admins
    if (!isOwnerOrAdmin(message.author.id)) return;
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Delete command message immediately
    try { await message.delete(); } catch (e) {}
    
    let responseMsg = null;
    
    try {
        switch (command) {
            // ===== BASIC COMMANDS =====
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
                responseMsg = await message.channel.send(`${days}d ${hours}h ${minutes}m ${seconds}s`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                break;
            }
            
            // ===== ADMIN MANAGEMENT (OWNER ONLY) =====
            case 'admin': {
                if (message.author.id !== OWNER_ID) {
                    responseMsg = await message.channel.send('❌ Owner only command');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                const subCmd = args.shift();
                if (!subCmd) {
                    responseMsg = await message.channel.send('Usage: -admin <add/remove/list> <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                    break;
                }
                
                if (subCmd === 'list') {
                    const adminList = Array.from(admins).map(id => `<@${id}>`).join('\n') || 'None';
                    responseMsg = await message.channel.send(`**Admins:**\n${adminList}`);
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 5000);
                    break;
                }
                
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Please mention a user');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                if (subCmd === 'add') {
                    admins.add(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Added ${targetUser.tag} as admin`);
                } else if (subCmd === 'remove') {
                    admins.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Removed ${targetUser.tag} from admins`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
            
            // ===== SUPER REACT COMMANDS =====
            case 'srar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -srar <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                superReactUsers.add(targetUser.id);
                saveData();
                responseMsg = await message.channel.send(`✅ Super reaction enabled for ${targetUser.tag}`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
            
            case 'unsr': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unsr <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                if (superReactUsers.has(targetUser.id)) {
                    superReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Super reaction disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`❌ ${targetUser.tag} is not in super react list`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
            
            case 'srlist': {
                if (superReactUsers.size === 0) {
                    responseMsg = await message.channel.send('No super react users');
                } else {
                    const list = [];
                    for (const id of superReactUsers) {
                        const user = await client.users.fetch(id).catch(() => null);
                        list.push(`• ${user ? user.tag : id}`);
                    }
                    responseMsg = await message.channel.send(`**Super React Users:**\n${list.join('\n')}`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 5000);
                break;
            }
            
            // ===== CUSTOM AUTO REACT COMMANDS =====
            case 'ar': {
                if (args.length < 2) {
                    responseMsg = await message.channel.send('Usage: -ar <user> <emoji1> [emoji2] [emoji3] [emoji4]');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                    break;
                }
                
                let targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                // Remove the user from args
                if (message.mentions.users.size > 0) {
                    args.shift(); // Remove mention
                } else {
                    args.shift(); // Remove ID
                }
                
                const emojis = args.slice(0, 4);
                autoReactUsers.set(targetUser.id, emojis);
                saveData();
                responseMsg = await message.channel.send(`✅ Auto-react set for ${targetUser.tag}: ${emojis.join(' ')}`);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
                break;
            }
            
            case 'unar': {
                if (args.length < 1) {
                    responseMsg = await message.channel.send('Usage: -unar <user>');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                let targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
                if (!targetUser) {
                    responseMsg = await message.channel.send('❌ User not found');
                    setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                    break;
                }
                
                if (autoReactUsers.has(targetUser.id)) {
                    autoReactUsers.delete(targetUser.id);
                    saveData();
                    responseMsg = await message.channel.send(`✅ Auto-react disabled for ${targetUser.tag}`);
                } else {
                    responseMsg = await message.channel.send(`❌ No auto-react for ${targetUser.tag}`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
                break;
            }
            
            case 'arlist': {
                if (autoReactUsers.size === 0) {
                    responseMsg = await message.channel.send('No auto-react users');
                } else {
                    const list = [];
                    for (const [id, emojis] of autoReactUsers.entries()) {
                        const user = await client.users.fetch(id).catch(() => null);
                        list.push(`• ${user ? user.tag : id}: ${emojis.join(' ')}`);
                    }
                    responseMsg = await message.channel.send(`**Auto-React Users:**\n${list.join('\n')}`);
                }
                setTimeout(() => responseMsg?.delete().catch(() => {}), 5000);
                break;
            }
            
            // ===== HELP COMMAND =====
            case 'help': {
                const helpText = [
                    '**SELFBOT COMMANDS**',
                    '',
                    '**Basic:**',
                    '`-ping` - Show latency',
                    '`-uptime` - Show uptime',
                    '',
                    '**Admin (Owner only):**',
                    '`-admin add @user` - Add admin',
                    '`-admin remove @user` - Remove admin',
                    '`-admin list` - List admins',
                    '',
                    '**Super React (🔥💀👀😈):**',
                    '`-srar @user` - Add super react',
                    '`-unsr @user` - Remove super react',
                    '`-srlist` - List super react users',
                    '',
                    '**Custom Auto-React:**',
                    '`-ar @user 😈 👍 ❤️` - Set custom reacts (up to 4)',
                    '`-unar @user` - Remove custom reacts',
                    '`-arlist` - List custom react users'
                ].join('\n');
                responseMsg = await message.channel.send(helpText);
                setTimeout(() => responseMsg?.delete().catch(() => {}), 10000);
                break;
            }
            
            default:
                responseMsg = await message.channel.send('❌ Unknown command. Use -help');
                setTimeout(() => responseMsg?.delete().catch(() => {}), 2000);
        }
    } catch (error) {
        console.error('Command error:', error);
        try {
            responseMsg = await message.channel.send(`❌ Error: ${error.message}`);
            setTimeout(() => responseMsg?.delete().catch(() => {}), 3000);
        } catch (e) {}
    }
});

// ===== ERROR HANDLING =====
client.on('error', (error) => {
    console.error('Client error:', error);
});

client.on('warn', (warning) => {
    console.warn('Client warning:', warning);
});

// ===== LOGIN =====
console.log('🚀 Starting selfbot...');
client.login(TOKEN).catch(error => {
    console.error('❌ Failed to login:', error.message);
    process.exit(1);
});
