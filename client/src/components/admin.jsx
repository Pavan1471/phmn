import React, { useState, useEffect, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SocketContext } from '../App';

function Admin() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [winner, setWinner] = useState(null);
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const appSocket = useContext(SocketContext);

  // Task Manager State
  const [adminTasks, setAdminTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', reward: '', link: '', icon: '🎯' });
  const [taskLoading, setTaskLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const loadMiningStats = useCallback(() => {
    if (!appSocket || !isAuthorized) return;
    
    if (!appSocket.connected) {
      showNotification('Not connected to server', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Add a timeout to prevent getting stuck if socket doesn't respond
    const timeout = setTimeout(() => {
      setLoading(false);
      showNotification('Refresh timed out', 'error');
    }, 5000);

    appSocket.emit('admin:getMiningStats', {}, (response) => {
      clearTimeout(timeout);
      setLoading(false);
      if (response?.success) {
        setStats(response);
        setWinner(response.raffleWinner);
      } else {
        setError(response?.error || 'Failed to load stats');
      }
    });

    // Load Admin Tasks
    appSocket.emit('admin:getTasks', {}, (response) => {
      if (response?.success) {
        setAdminTasks(response.tasks);
      }
    });
  }, [appSocket, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      loadMiningStats();
      const refreshInterval = setInterval(loadMiningStats, 10000);
      return () => clearInterval(refreshInterval);
    }
  }, [loadMiningStats, isAuthorized]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'hauBrOdvu08vOsagkZ') {
      setIsAuthorized(true);
      setError(null);
    } else {
      setError('Invalid password');
    }
  };

  const addTask = () => {
    if (!newTask.title || !newTask.reward || !newTask.link) return;
    setTaskLoading(true);
    appSocket.emit('admin:addTask', newTask, (res) => {
      setTaskLoading(false);
      if (res.success) {
        setAdminTasks([res.task, ...adminTasks]);
        setNewTask({ title: '', reward: '', link: '', icon: '🎯' });
        showNotification('Task added!');
      } else {
        showNotification(res.error, 'error');
      }
    });
  };

  const deleteTask = (taskId) => {
    if (!window.confirm('Are you sure?')) return;
    appSocket.emit('admin:deleteTask', { taskId }, (res) => {
      if (res.success) {
        setAdminTasks(adminTasks.filter(t => t._id !== taskId));
        showNotification('Task deleted');
      } else {
        showNotification(res.error, 'error');
      }
    });
  };

  const formatNumber = (num) => {
    return (num || 0).toLocaleString(undefined, {
      maximumFractionDigits: 5,
      minimumFractionDigits: 2
    });
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0f0a1a] flex items-center justify-center p-4">
        <motion.div 
          className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
            >
              Login
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="relative min-h-screen text-white font-sans overflow-x-hidden pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="grok-bg" />
      <div className="relative z-10 max-w-xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2 w-2 rounded-full ${appSocket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                {appSocket?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadMiningStats}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setIsAuthorized(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
            <div className="text-xs text-gray-400 uppercase font-bold mb-1">Active Miners</div>
            <div className="text-2xl font-bold text-white">{stats?.totalPlayers || 0}</div>
          </div>
          <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700">
            <div className="text-xs text-gray-400 uppercase font-bold mb-1">Total Supply</div>
            <div className="text-2xl font-bold text-white">{formatNumber(stats?.totalPHMNBalance)}</div>
          </div>
        </div>

        {/* Tasks Manager */}
        <div className="mb-8 p-6 bg-gray-800/40 rounded-2xl border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Tasks Manager</h2>
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Reward"
                value={newTask.reward}
                onChange={(e) => setNewTask({...newTask, reward: e.target.value})}
                className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white"
              />
            </div>
            <input
              type="text"
              placeholder="Link"
              value={newTask.link}
              onChange={(e) => setNewTask({...newTask, link: e.target.value})}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Icon (URL or Emoji)"
              value={newTask.icon}
              onChange={(e) => setNewTask({...newTask, icon: e.target.value})}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white"
            />
            <button
              onClick={addTask}
              disabled={taskLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg font-bold transition disabled:opacity-50"
            >
              Add Task
            </button>
          </div>

          <div className="space-y-3">
            {adminTasks.map((task) => (
              <div key={task._id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center">
                    {task.icon?.startsWith('http') ? (
                      <img src={task.icon} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xl">{task.icon || '🎯'}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{task.title}</div>
                    <div className="text-xs text-purple-400">+{task.reward} PHMN</div>
                  </div>
                </div>
                <button onClick={() => deleteTask(task._id)} className="text-red-500 p-2 hover:bg-red-500/10 rounded-lg">🗑️</button>
              </div>
            ))}
          </div>
        </div>

        {/* Streak Hall of Fame */}
        {stats?.streakAchievers?.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Streak Achievers</h2>
              <button
                onClick={() => {
                  appSocket.emit('admin:pickRaffleWinner', {}, (res) => {
                    if (res.success) {
                      setWinner(res.winnerName);
                      showNotification('Winner Picked!');
                    }
                  });
                }}
                className="px-3 py-1 bg-yellow-500 text-black rounded-lg text-xs font-bold"
              >
                Pick Winner
              </button>
            </div>

            {winner && (
              <div className="mb-4 p-4 bg-yellow-500/20 rounded-xl border border-yellow-500/30 text-center">
                <div className="text-xs uppercase text-yellow-500 font-bold mb-1">🏆 Winner 🏆</div>
                <div className="text-xl font-bold text-white">{winner}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {stats.streakAchievers.map((achiever) => (
                <div key={achiever.telegramId} className="bg-gray-800 p-3 rounded-lg border border-gray-700 text-sm">
                  {achiever.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Players List */}
        {stats?.players?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Live Miners</h2>
            <div className="bg-gray-800 rounded-xl p-2 border border-gray-700">
              {stats.players.map((player) => (
                <div key={player.telegramId} className="flex justify-between p-3 border-b border-gray-700 last:border-0">
                  <span className="text-sm">{player.name}</span>
                  <span className="text-xs text-purple-400 font-bold">{formatNumber(player.mined)} PHMN</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notification.show && (
        <div className={`fixed bottom-10 right-10 px-6 py-3 rounded-xl shadow-2xl z-50 text-white font-bold ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {notification.message}
        </div>
      )}
    </motion.div>
  );
}

export default Admin;
