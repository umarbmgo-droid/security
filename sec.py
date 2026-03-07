import discord
from discord.ext import commands
from discord import app_commands
import os
import time
import asyncio
import json
from datetime import datetime
from typing import Optional

# ===== CONFIGURATION =====
TOKEN = os.environ.get('TOKEN')
OWNER_ID = 361069640962801664  # Your Discord ID
START_TIME = time.time()

# Whitelisted role IDs that can ONLY be given to whitelisted users
WHITELISTED_ROLES = [
    1445025809390633061,
    1461044348287193180, 
    1474423910291345670,
    1477606862152270005,
    1305183864985092186
]

# ===== BOT SETUP =====
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=None, intents=intents, help_command=None)  # No prefix commands

# Data storage
admin_users = []
whitelisted_users = []

# Load data
try:
    with open('admin_users.json', 'r') as f:
        admin_users = json.load(f)
except FileNotFoundError:
    admin_users = [OWNER_ID]  # Owner is always admin

try:
    with open('whitelisted_users.json', 'r') as f:
        whitelisted_users = json.load(f)
except FileNotFoundError:
    whitelisted_users = []

def save_admins():
    with open('admin_users.json', 'w') as f:
        json.dump(admin_users, f, indent=4)

def save_whitelist():
    with open('whitelisted_users.json', 'w') as f:
        json.dump(whitelisted_users, f, indent=4)

# ===== HELPER FUNCTIONS =====
def get_uptime():
    current_time = time.time()
    uptime_seconds = int(current_time - START_TIME)
    
    days = uptime_seconds // 86400
    hours = (uptime_seconds % 86400) // 3600
    minutes = (uptime_seconds % 3600) // 60
    seconds = uptime_seconds % 60
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    
    return " ".join(parts)

def is_owner_or_admin(user_id):
    return user_id == OWNER_ID or user_id in admin_users

async def send_owner_alert(title: str, description: str, color: int = 0xFFFFFF):
    """Send a DM alert to the owner"""
    owner = bot.get_user(OWNER_ID)
    if owner:
        embed = discord.Embed(
            title=title,
            description=description,
            color=color
        )
        try:
            await owner.send(embed=embed)
        except:
            pass

# ===== EVENTS =====
@bot.event
async def on_ready():
    print("="*50)
    print("RANKED SECURITY IS ONLINE")
    print(f"Bot ID: {bot.user.id}")
    print(f"Servers: {len(bot.guilds)}")
    print(f"Whitelisted Roles: {len(WHITELISTED_ROLES)}")
    print(f"Admin Users: {len(admin_users)}")
    print(f"Whitelisted Users: {len(whitelisted_users)}")
    print("="*50)
    
    # Set streaming status
    await bot.change_presence(activity=discord.Streaming(
        name="Ranked",
        url="https://twitch.tv/ranked"
    ))
    
    # Sync slash commands
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"Failed to sync: {e}")
    
    # Alert owner that bot is online
    await send_owner_alert(
        "🟢 Bot Online",
        f"Ranked Security is now online in {len(bot.guilds)} servers"
    )

@bot.event
async def on_member_update(before, after):
    """Monitor role changes for whitelisted roles"""
    # Check if any whitelisted roles were added
    added_roles = set(after.roles) - set(before.roles)
    
    for role in added_roles:
        if role.id in WHITELISTED_ROLES:
            user_id = after.id
            
            # Check if user is whitelisted
            if user_id not in whitelisted_users and user_id != OWNER_ID:
                # Remove the role immediately
                try:
                    await after.remove_roles(role, reason="Not whitelisted for this role")
                    
                    # Alert owner
                    await send_owner_alert(
                        "⚠️ UNAUTHORIZED ROLE ATTEMPT",
                        f"**User:** {after.mention} ({after.name})\n"
                        f"**User ID:** `{after.id}`\n"
                        f"**Role:** {role.name} (`{role.id}`)\n"
                        f"**Action:** Role removed (not whitelisted)"
                    )
                except Exception as e:
                    await send_owner_alert(
                        "❌ ERROR REMOVING ROLE",
                        f"Failed to remove {role.name} from {after.name}\nError: {str(e)}"
                    )
            else:
                # Whitelisted user got the role - notify owner
                await send_owner_alert(
                    "✅ WHITELISTED ROLE ADDED",
                    f"**User:** {after.mention} ({after.name})\n"
                    f"**User ID:** `{after.id}`\n"
                    f"**Role:** {role.name} (`{role.id}`)\n"
                    f"**Status:** Whitelisted user - role allowed"
                )

# ===== SLASH COMMANDS =====

# Group commands
role_group = app_commands.Group(name="role", description="Role management commands")
admin_group = app_commands.Group(name="admin", description="Admin management commands")

# ===== ROLE COMMANDS =====
@role_group.command(name="whitelist", description="Whitelist a user to receive protected roles")
async def role_whitelist(interaction: discord.Interaction, user: discord.Member):
    """Whitelist a user (owner/admins only)"""
    if not is_owner_or_admin(interaction.user.id):
        embed = discord.Embed(
            description="❌ You don't have permission to use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    user_id = user.id
    
    if user_id in whitelisted_users:
        embed = discord.Embed(
            description=f"❌ {user.mention} is already whitelisted",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    whitelisted_users.append(user_id)
    save_whitelist()
    
    embed = discord.Embed(
        description=f"✅ {user.mention} has been whitelisted",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)
    
    # Alert owner
    await send_owner_alert(
        "📋 USER WHITELISTED",
        f"**User:** {user.mention} ({user.name})\n"
        f"**User ID:** `{user.id}`\n"
        f"**Whitelisted by:** {interaction.user.mention} ({interaction.user.name})"
    )

@role_group.command(name="unwhitelist", description="Remove whitelist from a user")
async def role_unwhitelist(interaction: discord.Interaction, user: discord.Member):
    """Remove whitelist from a user (owner/admins only)"""
    if not is_owner_or_admin(interaction.user.id):
        embed = discord.Embed(
            description="❌ You don't have permission to use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    user_id = user.id
    
    if user_id not in whitelisted_users:
        embed = discord.Embed(
            description=f"❌ {user.mention} is not whitelisted",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    whitelisted_users.remove(user_id)
    save_whitelist()
    
    # Check if user has any whitelisted roles and remove them
    removed_roles = []
    for role_id in WHITELISTED_ROLES:
        role = interaction.guild.get_role(role_id)
        if role and role in user.roles:
            try:
                await user.remove_roles(role, reason="Removed from whitelist")
                removed_roles.append(role.name)
            except:
                pass
    
    embed = discord.Embed(
        description=f"✅ {user.mention} has been removed from whitelist",
        color=0xFFFFFF
    )
    if removed_roles:
        embed.description += f"\nRemoved roles: {', '.join(removed_roles)}"
    
    await interaction.response.send_message(embed=embed)
    
    # Alert owner
    await send_owner_alert(
        "📋 USER UNWHITELISTED",
        f"**User:** {user.mention} ({user.name})\n"
        f"**User ID:** `{user.id}`\n"
        f"**Unwhitelisted by:** {interaction.user.mention} ({interaction.user.name})\n"
        f"**Roles removed:** {', '.join(removed_roles) if removed_roles else 'None'}"
    )

@role_group.command(name="list", description="List all whitelisted users")
async def role_list(interaction: discord.Interaction):
    """List all whitelisted users"""
    if not is_owner_or_admin(interaction.user.id):
        embed = discord.Embed(
            description="❌ You don't have permission to use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    if not whitelisted_users:
        embed = discord.Embed(
            description="No whitelisted users",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    whitelist_text = ""
    for i, user_id in enumerate(whitelisted_users, 1):
        user = bot.get_user(user_id)
        if user:
            whitelist_text += f"`{i}.` {user.mention} (`{user_id}`)\n"
        else:
            whitelist_text += f"`{i}.` Unknown User (`{user_id}`)\n"
    
    embed = discord.Embed(
        description=f"**Whitelisted Users ({len(whitelisted_users)}):**\n{whitelist_text}",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

# ===== ADMIN COMMANDS =====
@admin_group.command(name="add", description="Add a user as admin")
async def admin_add(interaction: discord.Interaction, user: discord.Member):
    """Add a user as admin (owner only)"""
    if interaction.user.id != OWNER_ID:
        embed = discord.Embed(
            description="❌ Only the owner can use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    user_id = user.id
    
    if user_id in admin_users:
        embed = discord.Embed(
            description=f"❌ {user.mention} is already an admin",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    admin_users.append(user_id)
    save_admins()
    
    embed = discord.Embed(
        description=f"✅ {user.mention} is now an admin",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

@admin_group.command(name="remove", description="Remove admin from a user")
async def admin_remove(interaction: discord.Interaction, user: discord.Member):
    """Remove admin from a user (owner only)"""
    if interaction.user.id != OWNER_ID:
        embed = discord.Embed(
            description="❌ Only the owner can use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    user_id = user.id
    
    if user_id == OWNER_ID:
        embed = discord.Embed(
            description="❌ Cannot remove owner from admin list",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    if user_id not in admin_users:
        embed = discord.Embed(
            description=f"❌ {user.mention} is not an admin",
            color=0xFFFFFF
        )
        await interaction.response.send_message(embed=embed)
        return
    
    admin_users.remove(user_id)
    save_admins()
    
    embed = discord.Embed(
        description=f"✅ {user.mention} is no longer an admin",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

@admin_group.command(name="list", description="List all admins")
async def admin_list(interaction: discord.Interaction):
    """List all admins"""
    if not is_owner_or_admin(interaction.user.id):
        embed = discord.Embed(
            description="❌ You don't have permission to use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    admin_text = f"👑 Owner: <@{OWNER_ID}>\n\n**Admins:**\n"
    
    if admin_users:
        for user_id in admin_users:
            if user_id != OWNER_ID:
                user = bot.get_user(user_id)
                if user:
                    admin_text += f"• {user.mention} (`{user_id}`)\n"
                else:
                    admin_text += f"• Unknown User (`{user_id}`)\n"
    else:
        admin_text += "No admins"
    
    embed = discord.Embed(
        description=admin_text,
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

# ===== BASIC COMMANDS =====
@bot.tree.command(name="ping", description="Check bot latency")
async def ping(interaction: discord.Interaction):
    embed = discord.Embed(
        description=f"Pong! `{round(bot.latency * 1000)}ms`",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="uptime", description="Show how long the bot has been running")
async def uptime(interaction: discord.Interaction):
    uptime_str = get_uptime()
    embed = discord.Embed(
        description=f"🕐 `{uptime_str}`",
        color=0xFFFFFF
    )
    await interaction.response.send_message(embed=embed)

# ===== CHECK COMMANDS =====
@bot.tree.command(name="check", description="Check if a user is whitelisted")
async def check(interaction: discord.Interaction, user: discord.Member):
    """Check if a user is whitelisted"""
    if not is_owner_or_admin(interaction.user.id):
        embed = discord.Embed(
            description="❌ You don't have permission to use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    user_id = user.id
    
    if user_id in whitelisted_users or user_id == OWNER_ID:
        embed = discord.Embed(
            description=f"✅ {user.mention} is whitelisted",
            color=0xFFFFFF
        )
    else:
        embed = discord.Embed(
            description=f"❌ {user.mention} is not whitelisted",
            color=0xFFFFFF
        )
    
    await interaction.response.send_message(embed=embed)

# ===== OWNER ONLY COMMANDS =====
@bot.tree.command(name="broadcast", description="Broadcast a message to all servers (owner only)")
async def broadcast(interaction: discord.Interaction, message: str):
    if interaction.user.id != OWNER_ID:
        embed = discord.Embed(
            description="❌ Only the owner can use this command",
            color=0xFFFFFF
        )
        return await interaction.response.send_message(embed=embed, ephemeral=True)
    
    await interaction.response.send_message(embed=discord.Embed(description="📢 Broadcasting...", color=0xFFFFFF), ephemeral=True)
    
    embed = discord.Embed(
        description=f"📢 **Broadcast**\n\n{message}",
        color=0xFFFFFF
    )
    
    success = 0
    failed = 0
    
    for guild in bot.guilds:
        try:
            channel = guild.system_channel or next((c for c in guild.text_channels if c.permissions_for(guild.me).send_messages), None)
            if channel:
                await channel.send(embed=embed)
                success += 1
            else:
                failed += 1
        except:
            failed += 1
        await asyncio.sleep(1)
    
    await interaction.followup.send(
        embed=discord.Embed(
            description=f"✅ Broadcast sent to {success} servers\n❌ Failed: {failed} servers",
            color=0xFFFFFF
        ),
        ephemeral=True
    )

# ===== REGISTER COMMANDS =====
bot.tree.add_command(role_group)
bot.tree.add_command(admin_group)

# ===== ERROR HANDLING =====
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    embed = discord.Embed(
        description=f"❌ An error occurred: {str(error)}",
        color=0xFFFFFF
    )
    
    try:
        await interaction.response.send_message(embed=embed, ephemeral=True)
    except:
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    # Alert owner of errors
    if interaction.user.id != OWNER_ID:
        await send_owner_alert(
            "⚠️ COMMAND ERROR",
            f"**User:** {interaction.user.mention}\n"
            f"**Command:** `/{interaction.command.name}`\n"
            f"**Error:** {str(error)}"
        )

# ===== RUN BOT =====
if __name__ == "__main__":
    print("Starting Ranked Security...")
    
    # Create data files if they don't exist
    for file in ['admin_users.json', 'whitelisted_users.json']:
        if not os.path.exists(file):
            with open(file, 'w') as f:
                json.dump([] if file == 'whitelisted_users.json' else [OWNER_ID], f)
    
    try:
        bot.run(TOKEN)
    except discord.LoginFailure:
        print("Invalid token")
    except Exception as e:
        print(f"Error: {e}")