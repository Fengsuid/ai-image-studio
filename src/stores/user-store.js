"use strict";

function createUserStore({
  getPool,
  mapUser,
  mapCreditLedger,
  mapRewardLedger,
  mapGeneration,
  getGenerationById
}) {
  async function insertCreditLedger(entry, connection = getPool()) {
    await connection.execute(
      `INSERT INTO credit_ledger
        (user_id, delta, balance_after, source, reference_id, note, actor_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        Number(entry.delta || 0),
        Math.max(0, Number(entry.balanceAfter || 0)),
        String(entry.source || "manual").slice(0, 40),
        String(entry.referenceId || "").slice(0, 64),
        String(entry.note || "").slice(0, 255),
        entry.actorUserId || null
      ]
    );
  }

  async function insertRewardLedger(entry, connection = getPool()) {
    await connection.execute(
      `INSERT INTO reward_ledger
        (user_id, reward_type, status, amount, reference_id, note, awarded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        String(entry.rewardType || "reward").slice(0, 40),
        String(entry.status || "awarded").slice(0, 24),
        Math.max(0, Number(entry.amount || 0)),
        String(entry.referenceId || "").slice(0, 64),
        String(entry.note || "").slice(0, 255),
        entry.awardedAt || null
      ]
    );
  }

  async function countUsers() {
    const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users");
    return Number(rows[0]?.count || 0);
  }

  async function countAdmins() {
    const [rows] = await getPool().execute("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    return Number(rows[0]?.count || 0);
  }

  async function getUserByEmail(email) {
    const [rows] = await getPool().execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    return mapUser(rows[0]);
  }

  async function getUserById(id) {
    const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    return mapUser(rows[0]);
  }

  async function createUser(user) {
    const createdAt = new Date();
    await getPool().execute(
      `INSERT INTO users
        (id, name, email, password_salt, password_iterations, password_hash, role, status, credits, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash.salt,
        user.passwordHash.iterations,
        user.passwordHash.hash,
        user.role,
        user.status,
        user.credits,
        createdAt,
        createdAt
      ]
    );
    if (Number(user.credits || 0) > 0) {
      await insertCreditLedger({
        userId: user.id,
        delta: Number(user.credits || 0),
        balanceAfter: Number(user.credits || 0),
        source: "signup_default",
        note: "Initial credits"
      });
    }
    return getUserById(user.id);
  }

  async function listUsers({ search = "", status = "", role = "", rewardStatus = "", limit = 500, offset = 0 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(1000, Number(limit) || 500));
    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const where = [];
    const values = [];
    const query = String(search || "").trim().toLowerCase();
    if (query) {
      where.push("(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.id = ?)");
      values.push(`%${query}%`, `%${query}%`, query);
    }
    if (status && status !== "all") {
      where.push("u.status = ?");
      values.push(status);
    }
    if (role && role !== "all") {
      where.push("u.role = ?");
      values.push(role);
    }
    if (rewardStatus && rewardStatus !== "all") {
      if (rewardStatus === "none") {
        where.push("fpr.status IS NULL");
      } else {
        where.push("fpr.status = ?");
        values.push(rewardStatus);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await getPool().execute(
      `SELECT u.*,
              fpr.status AS first_public_reward_status,
              fpr.amount AS first_public_reward_amount,
              fpr.reference_id AS first_public_reward_reference_id,
              fpr.awarded_at AS first_public_reward_awarded_at,
              fpr.created_at AS first_public_reward_created_at
         FROM users u
         LEFT JOIN (
           SELECT rl.*
             FROM reward_ledger rl
             INNER JOIN (
               SELECT user_id, MAX(id) AS id
                 FROM reward_ledger
                WHERE reward_type = 'first_public'
                GROUP BY user_id
             ) latest ON latest.id = rl.id
         ) fpr ON fpr.user_id = u.id
         ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT ${normalizedLimit} OFFSET ${normalizedOffset}`,
      values
    );
    return rows.map(mapUser);
  }

  async function updateUser(id, patch) {
    const columns = [];
    const values = [];
    const mapping = {
      name: "name",
      role: "role",
      status: "status"
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (Object.hasOwn(patch, key)) {
        columns.push(`${column} = ?`);
        values.push(patch[key]);
      }
    }

    if (columns.length) {
      columns.push("updated_at = ?");
      values.push(new Date(), id);
      await getPool().execute(`UPDATE users SET ${columns.join(", ")} WHERE id = ?`, values);
    }
    return getUserById(id);
  }

  async function updateUserPassword(id, passwordHash) {
    await getPool().execute(
      `UPDATE users
         SET password_salt = ?, password_iterations = ?, password_hash = ?, updated_at = ?
       WHERE id = ?`,
      [
        passwordHash.salt,
        passwordHash.iterations,
        passwordHash.hash,
        new Date(),
        id
      ]
    );
    return getUserById(id);
  }

  async function createSession(tokenHash, userId, expiresAt) {
    await getPool().execute(
      "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [tokenHash, userId, expiresAt, new Date()]
    );
  }

  async function deleteSession(tokenHash) {
    if (!tokenHash) return;
    await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
  }

  async function touchSession(tokenHash, expiresAt) {
    await getPool().execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expiresAt, tokenHash]);
  }

  async function getSessionUser(tokenHash) {
    const [rows] = await getPool().execute(
      `SELECT u.*
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
        LIMIT 1`,
      [tokenHash, new Date()]
    );
    return mapUser(rows[0]);
  }

  async function deleteExpiredSessions() {
    await getPool().execute("DELETE FROM sessions WHERE expires_at <= ?", [new Date()]);
  }

  async function reserveCredits(userId, amount, meta = {}) {
    const [result] = await getPool().execute(
      "UPDATE users SET credits = credits - ?, updated_at = ? WHERE id = ? AND credits >= ?",
      [amount, new Date(), userId, amount]
    );
    if (result.affectedRows !== 1) return false;
    const balanceAfter = await getUserCredits(userId);
    await insertCreditLedger({
      userId,
      delta: -Math.abs(Number(amount) || 0),
      balanceAfter,
      source: meta.source || "generation_charge",
      referenceId: meta.referenceId,
      note: meta.note,
      actorUserId: meta.actorUserId
    });
    return true;
  }

  async function addCredits(userId, amount, meta = {}) {
    if (amount <= 0) return;
    await getPool().execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
      amount,
      new Date(),
      userId
    ]);
    const balanceAfter = await getUserCredits(userId);
    await insertCreditLedger({
      userId,
      delta: Math.abs(Number(amount) || 0),
      balanceAfter,
      source: meta.source || "credit_grant",
      referenceId: meta.referenceId,
      note: meta.note,
      actorUserId: meta.actorUserId
    });
  }

  async function setUserCredits(userId, credits, meta = {}) {
    const nextCredits = Math.max(0, Math.min(100000, Number.parseInt(credits, 10) || 0));
    const before = await getUserById(userId);
    await getPool().execute("UPDATE users SET credits = ?, updated_at = ? WHERE id = ?", [
      nextCredits,
      new Date(),
      userId
    ]);
    const amount = nextCredits - Number(before?.credits || 0);
    if (amount) {
      await insertCreditLedger({
        userId,
        delta: amount,
        balanceAfter: nextCredits,
        source: meta.source || "admin_set",
        referenceId: meta.referenceId,
        note: meta.note,
        actorUserId: meta.actorUserId
      });
    }
    return getUserById(userId);
  }

  async function adjustCredits(userId, delta, meta = {}) {
    const amount = Number(delta) || 0;
    if (!amount) return getUserById(userId);
    if (amount > 0) {
      await addCredits(userId, amount, {
        source: meta.source || "admin_adjustment",
        referenceId: meta.referenceId,
        note: meta.note,
        actorUserId: meta.actorUserId
      });
    } else {
      const deduction = Math.abs(amount);
      await getPool().execute(
        "UPDATE users SET credits = IF(credits < ?, 0, credits - ?), updated_at = ? WHERE id = ?",
        [deduction, deduction, new Date(), userId]
      );
      const balanceAfter = await getUserCredits(userId);
      await insertCreditLedger({
        userId,
        delta: amount,
        balanceAfter,
        source: meta.source || "admin_adjustment",
        referenceId: meta.referenceId,
        note: meta.note,
        actorUserId: meta.actorUserId
      });
    }
    return getUserById(userId);
  }

  async function hasCheckedInToday(userId) {
    const [rows] = await getPool().execute(
      "SELECT user_id FROM user_checkins WHERE user_id = ? AND checkin_date = CURRENT_DATE() LIMIT 1",
      [userId]
    );
    return rows.length > 0;
  }

  async function checkInToday(userId, creditAmount = 1) {
    const amount = Math.max(1, Number(creditAmount) || 1);
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [insertResult] = await connection.execute(
        "INSERT IGNORE INTO user_checkins (user_id, checkin_date, credits_awarded) VALUES (?, CURRENT_DATE(), ?)",
        [userId, amount]
      );
      if (insertResult.affectedRows === 0) {
        const [rows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
        await connection.rollback();
        return { checkedIn: false, credits: Number(rows[0]?.credits || 0) };
      }
      await connection.execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
        amount,
        new Date(),
        userId
      ]);
      const [rows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
      const balanceAfter = Number(rows[0]?.credits || 0);
      await insertCreditLedger({
        userId,
        delta: amount,
        balanceAfter,
        source: "daily_checkin",
        referenceId: `checkin:${new Date().toISOString().slice(0, 10)}`,
        note: "Daily check-in reward"
      }, connection);
      await insertRewardLedger({
        userId,
        rewardType: "daily_checkin",
        status: "awarded",
        amount,
        referenceId: `checkin:${new Date().toISOString().slice(0, 10)}`,
        note: "Daily check-in reward",
        awardedAt: new Date()
      }, connection);
      await connection.commit();
      return { checkedIn: true, credits: balanceAfter };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function reserveDailyFreeGeneration(userId, freeLimit) {
    const limit = Math.max(0, Number(freeLimit) || 0);
    if (!limit) return false;
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() FOR UPDATE",
        [userId]
      );
      const used = Number(rows[0]?.free_used || 0);
      if (!rows.length) {
        await connection.execute(
          "INSERT INTO user_daily_usage (user_id, usage_date, free_used) VALUES (?, CURRENT_DATE(), 1)",
          [userId]
        );
        await connection.commit();
        return true;
      }
      if (used >= limit) {
        await connection.rollback();
        return false;
      }
      await connection.execute(
        "UPDATE user_daily_usage SET free_used = free_used + 1 WHERE user_id = ? AND usage_date = CURRENT_DATE()",
        [userId]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function refundDailyFreeGeneration(userId) {
    await getPool().execute(
      "UPDATE user_daily_usage SET free_used = GREATEST(free_used - 1, 0) WHERE user_id = ? AND usage_date = CURRENT_DATE()",
      [userId]
    );
  }

  async function getDailyFreeUsed(userId) {
    const [rows] = await getPool().execute(
      "SELECT free_used FROM user_daily_usage WHERE user_id = ? AND usage_date = CURRENT_DATE() LIMIT 1",
      [userId]
    );
    return Number(rows[0]?.free_used || 0);
  }

  async function getUserCredits(userId) {
    const [rows] = await getPool().execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [userId]);
    return Number(rows[0]?.credits || 0);
  }

  async function listCreditLedger({ userId = "", limit = 100 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const values = [];
    const where = userId ? "WHERE cl.user_id = ?" : "";
    if (userId) values.push(userId);
    const [rows] = await getPool().execute(
      `SELECT cl.*, u.name AS user_name, u.email AS user_email, au.name AS actor_name, au.email AS actor_email
         FROM credit_ledger cl
         LEFT JOIN users u ON u.id = cl.user_id
         LEFT JOIN users au ON au.id = cl.actor_user_id
         ${where}
        ORDER BY cl.created_at DESC
        LIMIT ${normalizedLimit}`,
      values
    );
    return rows.map(mapCreditLedger);
  }

  async function listRewardLedger({ userId = "", limit = 100 } = {}) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const values = [];
    const where = userId ? "WHERE rl.user_id = ?" : "";
    if (userId) values.push(userId);
    const [rows] = await getPool().execute(
      `SELECT rl.*, u.name AS user_name, u.email AS user_email
         FROM reward_ledger rl
         LEFT JOIN users u ON u.id = rl.user_id
         ${where}
        ORDER BY rl.created_at DESC
        LIMIT ${normalizedLimit}`,
      values
    );
    return rows.map(mapRewardLedger);
  }

  async function hasFirstPublicReward(userId) {
    const [rewardRows] = await getPool().execute(
      "SELECT id FROM reward_ledger WHERE user_id = ? AND reward_type = 'first_public' LIMIT 1",
      [userId]
    );
    if (rewardRows.length) return true;
    const [pendingRows] = await getPool().execute(
      "SELECT id FROM generations WHERE user_id = ? AND public_reward_status IN ('pending', 'awarded', 'cancelled') LIMIT 1",
      [userId]
    );
    return pendingRows.length > 0;
  }

  async function claimFirstPublicReward(generationId, userId, amount = 0) {
    const rewardAmount = Math.max(0, Number(amount) || 0);
    if (!generationId || !userId || rewardAmount <= 0) return null;
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [userRows] = await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (!userRows.length) {
        await connection.rollback();
        return null;
      }
      const [existingRewards] = await connection.execute(
        "SELECT id FROM reward_ledger WHERE user_id = ? AND reward_type = 'first_public' LIMIT 1 FOR UPDATE",
        [userId]
      );
      if (existingRewards.length) {
        await connection.rollback();
        return null;
      }
      const [existingGenerationRewards] = await connection.execute(
        "SELECT id FROM generations WHERE user_id = ? AND public_reward_status IN ('pending', 'awarded', 'cancelled') LIMIT 1 FOR UPDATE",
        [userId]
      );
      if (existingGenerationRewards.length) {
        await connection.rollback();
        return null;
      }
      const [targetRows] = await connection.execute(
        "SELECT id, is_public, archived, moderation_status FROM generations WHERE id = ? AND user_id = ? FOR UPDATE",
        [generationId, userId]
      );
      const target = targetRows[0];
      if (!target || !target.is_public || target.archived || !["visible", "restored"].includes(target.moderation_status || "visible")) {
        await connection.rollback();
        return null;
      }
      await connection.execute(
        `UPDATE generations
            SET public_reward_status = 'pending',
                public_reward_amount = ?,
                withdrawal_status = 'none',
                published_at = IFNULL(published_at, NOW(3))
          WHERE id = ? AND user_id = ?`,
        [rewardAmount, generationId, userId]
      );
      await insertRewardLedger({
        userId,
        rewardType: "first_public",
        status: "pending",
        amount: rewardAmount,
        referenceId: generationId,
        note: "First public work reward pending"
      }, connection);
      await connection.commit();
      return getGenerationById(generationId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function cancelFirstPublicReward(generationId, note = "First public reward cancelled", connection = getPool()) {
    if (!generationId) return;
    await connection.execute(
      `UPDATE reward_ledger
          SET status = 'cancelled',
              note = ?
        WHERE reward_type = 'first_public'
          AND reference_id = ?
          AND status = 'pending'`,
      [String(note || "First public reward cancelled").slice(0, 255), generationId]
    );
  }

  async function awardMaturePublicRewards({ minAgeMinutes = 720 } = {}) {
    const [rows] = await getPool().execute(
      `SELECT * FROM generations
        WHERE is_public = 1
          AND archived = 0
          AND public_reward_status = 'pending'
          AND moderation_status IN ('visible', 'restored')
          AND published_at IS NOT NULL
          AND published_at <= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
          AND withdrawal_status IN ('none', 'rejected')
        ORDER BY published_at ASC
        LIMIT 100`,
      [Math.max(1, Number(minAgeMinutes) || 720)]
    );
    let awarded = 0;
    const awardedItems = [];
    for (const row of rows) {
      if (await awardMaturePublicReward(row.id, { minAgeMinutes })) {
        awarded += 1;
        awardedItems.push({
          id: row.id,
          userId: row.user_id,
          amount: Number(row.public_reward_amount || 0)
        });
      }
    }
    return { awarded, awardedItems };
  }

  async function awardMaturePublicReward(generationId, { minAgeMinutes = 720 } = {}) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT *
           FROM generations
          WHERE id = ?
            AND public_reward_status = 'pending'
          FOR UPDATE`,
        [generationId]
      );
      const generation = mapGeneration(rows[0]);
      if (
        !generation ||
        !generation.isPublic ||
        generation.archived ||
        !["visible", "restored"].includes(generation.moderationStatus || "visible") ||
        !generation.publishedAt ||
        Date.now() - new Date(generation.publishedAt).getTime() < Math.max(1, Number(minAgeMinutes) || 720) * 60 * 1000 ||
        !["none", "rejected"].includes(generation.withdrawalStatus || "none")
      ) {
        await connection.rollback();
        return false;
      }
      await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [generation.userId]);
      const [awardedRows] = await connection.execute(
        `SELECT id, reference_id
           FROM reward_ledger
          WHERE user_id = ?
            AND reward_type = 'first_public'
            AND status = 'awarded'
          LIMIT 1
          FOR UPDATE`,
        [generation.userId]
      );
      if (awardedRows.length && awardedRows[0].reference_id !== generation.id) {
        await connection.execute(
          "UPDATE generations SET public_reward_status = 'cancelled' WHERE id = ?",
          [generation.id]
        );
        await cancelFirstPublicReward(generation.id, "Superseded by existing first public reward", connection);
        await connection.commit();
        return false;
      }
      const amount = Number(generation.publicRewardAmount || 0);
      if (amount > 0) {
        await connection.execute("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?", [
          amount,
          new Date(),
          generation.userId
        ]);
        const [balanceRows] = await connection.execute("SELECT credits FROM users WHERE id = ? LIMIT 1", [generation.userId]);
        await insertCreditLedger({
          userId: generation.userId,
          delta: amount,
          balanceAfter: Number(balanceRows[0]?.credits || 0),
          source: "first_public_reward",
          referenceId: generation.id,
          note: "First public work reward"
        }, connection);
        const [rewardUpdate] = await connection.execute(
          `UPDATE reward_ledger
              SET status = 'awarded',
                  amount = ?,
                  note = 'Public reward hold elapsed',
                  awarded_at = ?
            WHERE user_id = ?
              AND reward_type = 'first_public'
              AND reference_id = ?
              AND status = 'pending'`,
          [amount, new Date(), generation.userId, generation.id]
        );
        if (rewardUpdate.affectedRows === 0) {
          await insertRewardLedger({
            userId: generation.userId,
            rewardType: "first_public",
            status: "awarded",
            amount,
            referenceId: generation.id,
            note: "Public reward hold elapsed",
            awardedAt: new Date()
          }, connection);
        }
      }
      await connection.execute(
        "UPDATE generations SET public_reward_status = 'awarded' WHERE id = ?",
        [generation.id]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    countUsers,
    countAdmins,
    getUserByEmail,
    getUserById,
    createUser,
    listUsers,
    updateUser,
    updateUserPassword,
    createSession,
    deleteSession,
    touchSession,
    getSessionUser,
    deleteExpiredSessions,
    setUserCredits,
    reserveCredits,
    addCredits,
    adjustCredits,
    listCreditLedger,
    listRewardLedger,
    hasFirstPublicReward,
    claimFirstPublicReward,
    cancelFirstPublicReward,
    awardMaturePublicRewards,
    hasCheckedInToday,
    checkInToday,
    reserveDailyFreeGeneration,
    refundDailyFreeGeneration,
    getDailyFreeUsed,
    getUserCredits
  };
}

module.exports = createUserStore;
