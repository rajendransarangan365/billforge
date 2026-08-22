const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { db } = await connectToDatabase();
    const convCol = db.collection('conversations');
    const msgCol = db.collection('messages');

    // === GET Handler ===
    if (req.method === 'GET') {
      const { action, userId, conversationId, search } = req.query;

      // 1. Fetch Conversations for logged-in user ONLY (Contacts ≠ Conversations)
      if (action === 'conversations') {
        if (!userId) {
          return res.status(400).json({ success: false, error: 'userId parameter required' });
        }
        let filter = { participants: userId };
        if (search) {
          filter.$or = [
            { 'participant_details.name': { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
          ];
        }
        const conversations = await convCol.find(filter).sort({ updated_at: -1 }).toArray();
        return res.status(200).json({ success: true, conversations });
      }

      // 2. Fetch Messages for a specific conversation
      if (action === 'messages' || conversationId) {
        const convId = conversationId || req.query.convId;
        if (!convId) {
          return res.status(400).json({ success: false, error: 'conversationId required' });
        }

        // Security check: verify user is participant
        if (userId) {
          const conv = await convCol.findOne({ id: convId });
          if (conv && Array.isArray(conv.participants) && !conv.participants.includes(userId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Not a conversation participant' });
          }

          // Mark unread = 0 for this user
          if (conv && conv.unread_counts && conv.unread_counts[userId] > 0) {
            await convCol.updateOne(
              { id: convId },
              { $set: { [`unread_counts.${userId}`]: 0 } }
            );
          }
        }

        const messages = await msgCol.find({ conversation_id: convId }).sort({ timestamp: 1 }).limit(200).toArray();
        return res.status(200).json({ success: true, messages });
      }

      // 3. User Directory Search for Starting NEW Chats (Does NOT create conversations)
      if (action === 'search_users') {
        const quarriesCol = db.collection('quarries');
        const driversCol = db.collection('drivers');
        const queryStr = search ? search.trim() : '';

        const quarries = await quarriesCol.find(queryStr ? { name: { $regex: queryStr, $options: 'i' } } : {}).limit(20).toArray();
        const drivers = await driversCol.find(queryStr ? { name: { $regex: queryStr, $options: 'i' } } : {}).limit(20).toArray();

        return res.status(200).json({ success: true, quarries, drivers });
      }

      return res.status(400).json({ success: false, error: 'Invalid action parameter' });
    }

    // === POST Handler (Send Message / Create Conversation) ===
    if (req.method === 'POST') {
      const { conversationId, clientMessageId, senderId, senderName, senderRole, text, targetUser, contextType, contextId } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: 'Message text required' });
      }
      if (!senderId) {
        return res.status(400).json({ success: false, error: 'senderId required' });
      }

      let activeConvId = conversationId;
      let convObj = null;

      // Create conversation if it doesn't exist yet
      if (!activeConvId && targetUser) {
        const pair = [String(senderId), String(targetUser.id)].sort();
        activeConvId = `conv_${pair.join('_')}`;

        convObj = await convCol.findOne({ id: activeConvId });
        if (!convObj) {
          convObj = {
            id: activeConvId,
            type: 'direct',
            participants: [senderId, targetUser.id],
            participant_details: [
              { id: senderId, name: senderName, role: senderRole || 'user' },
              { id: targetUser.id, name: targetUser.name, role: targetUser.role || 'user', phone: targetUser.phone },
            ],
            last_message: text.trim(),
            last_message_time: new Date().toISOString(),
            unread_counts: { [targetUser.id]: 1, [senderId]: 0 },
            context_type: contextType || 'direct',
            context_id: contextId || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await convCol.insertOne(convObj);
        }
      } else if (activeConvId) {
        convObj = await convCol.findOne({ id: activeConvId });
      }

      if (!activeConvId) {
        return res.status(400).json({ success: false, error: 'Target user or conversationId required' });
      }

      // Idempotency check: check if message with clientMessageId already processed
      if (clientMessageId) {
        const existing = await msgCol.findOne({ clientMessageId });
        if (existing) {
          return res.status(200).json({ success: true, message: existing, duplicate: true });
        }
      }

      const msgObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        conversation_id: activeConvId,
        clientMessageId: clientMessageId || null,
        sender_id: senderId,
        sender_name: senderName || 'User',
        sender_role: senderRole || 'user',
        text: text.trim(),
        status: 'delivered',
        timestamp: new Date().toISOString(),
      };

      await msgCol.insertOne(msgObj);

      // Update Conversation last message and unread counts
      if (convObj && Array.isArray(convObj.participants)) {
        const unreadUpdates = {};
        for (const pId of convObj.participants) {
          if (pId !== senderId) {
            unreadUpdates[`unread_counts.${pId}`] = ((convObj.unread_counts && convObj.unread_counts[pId]) || 0) + 1;
          }
        }
        await convCol.updateOne(
          { id: activeConvId },
          {
            $set: {
              last_message: text.trim(),
              last_message_time: msgObj.timestamp,
              updated_at: msgObj.timestamp,
              ...unreadUpdates,
            },
          }
        );
      }

      return res.status(201).json({ success: true, message: msgObj, conversationId: activeConvId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
