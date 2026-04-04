import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FloatingHeader } from '../components/ui/floating-header';
import ResourceCard from '../components/ResourceCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, RefreshCw, Plus, Search, Sparkles, FileText } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ResourceHub() {
  const { user, idToken, loading: authLoading } = useAuth();
  const [resources, setResources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Initialize from cache
  useEffect(() => {
    const cached = localStorage.getItem('skillroute_resources');
    if (cached) {
      try {
        setResources(JSON.parse(cached));
        setIsLoading(false); // Immediate render
      } catch (e) {
        console.warn("Failed to parse cached resources", e);
      }
    }
  }, []);

  // New Resource Form State
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('Link');
  const [newCategory, setNewCategory] = useState('');

  const fetchResources = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/resources/`, {
        headers: { 
          'x-user-id': user.uid,
          ...(idToken && { Authorization: `Bearer ${idToken}` })
        }
      });
      setResources(response.data);
      localStorage.setItem('skillroute_resources', JSON.stringify(response.data));
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchResources();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, idToken, authLoading]);

  const handleSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/resources/sync`, {}, {
        headers: { 
          'x-user-id': user.uid,
          ...(idToken && { Authorization: `Bearer ${idToken}` })
        }
      });
      alert(response.data.message);
      fetchResources();
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Failed to sync with S3. Check console for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!user || !searchQuery.trim()) {
      fetchResources();
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/resources/search`, {
        query: searchQuery,
        limit: 10
      }, {
        headers: { 
          'x-user-id': user.uid,
          ...(idToken && { Authorization: `Bearer ${idToken}` })
        }
      });
      
      if (response.data && response.data.matches) {
         setResources(response.data.matches);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await axios.post(`${API_BASE_URL}/api/resources/`, {
        title: newTitle,
        url: newUrl,
        resource_type: newType,
        category: newCategory || 'General'
      }, {
        headers: { 
          'x-user-id': user.uid,
          ...(idToken && { Authorization: `Bearer ${idToken}` })
        }
      });
      
      setNewTitle('');
      setNewUrl('');
      setNewCategory('');
      setIsFormOpen(false);
      fetchResources();
      
    } catch (error) {
      console.error("Failed to add resource:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <FloatingHeader />
      
      <main className="container mx-auto px-4 pt-32 pb-16 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900 dark:text-white">Resource Hub</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your PDFs, URLs, and notes. Semantic search powered by AI.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
              variant="outline"
              disabled={isSyncing}
              className="flex items-center gap-2 px-6 py-2 rounded-full border-zinc-200 dark:border-zinc-800 transition-all shadow-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
              onClick={handleSync}
            >
              {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 text-blue-500" />}
              <span>Sync S3</span>
            </Button>
            <Button 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full transition-all shadow-lg hover:shadow-blue-500/20"
              onClick={() => setIsFormOpen(!isFormOpen)}
            >
              <Plus className="w-5 h-5" />
              {isFormOpen ? "Cancel" : "Add Resource"}
            </Button>
          </div>
        </div>

        {/* Add Resource Form Inline */}
        {isFormOpen && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-8 rounded-3xl mb-8 shadow-2xl transition-all">
            <h2 className="text-2xl font-bold mb-4">Add New Resource</h2>
            <form onSubmit={handleAddResource} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Advanced React Patterns" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input required value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Frontend" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select 
                  className="flex h-10 w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  value={newType} 
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="Link">Web Link</option>
                  <option value="Video">Video</option>
                  <option value="PDF">PDF</option>
                  <option value="Book">Book</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-2">
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 font-bold shadow-lg">
                  Save Resource
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-12 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
          <form onSubmit={handleSearch} className="relative flex items-center bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
             <Search className="absolute left-4 w-6 h-6 text-muted-foreground" />
             <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Ask AI: e.g. 'Show me notes about binary search trees...'"
               className="w-full bg-transparent py-4 pl-14 pr-32 text-lg focus:outline-none rounded-xl"
             />
              <Button 
                type="submit" 
                disabled={isSearching}
                className="absolute right-2 bg-blue-600 text-white hover:bg-blue-700 h-10 rounded-xl flex items-center gap-2 px-6"
              >
                {isSearching ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 text-yellow-400" />}
                <span>AI Search</span>
              </Button>
          </form>
        </div>

        {/* Resource Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
             <Loader2 className="animate-spin w-10 h-10 text-muted-foreground" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-300 dark:border-zinc-800 rounded-2xl">
             <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
             <h3 className="text-xl font-semibold mb-2">No resources found</h3>
             <p className="text-muted-foreground">Upload PDFs via Telegram or add a link to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {resources.map((res, index) => (
              <ResourceCard key={res.id || index} resource={res} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
