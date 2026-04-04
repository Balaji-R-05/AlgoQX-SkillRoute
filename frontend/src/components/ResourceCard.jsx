import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ExternalLink, FileText, Video, Link as LinkIcon, BookOpen } from 'lucide-react';

const getIcon = (type) => {
  switch (type?.toLowerCase()) {
    case 'pdf': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'video': return <Video className="h-5 w-5 text-red-500" />;
    case 'book': return <BookOpen className="h-5 w-5 text-green-500" />;
    default: return <LinkIcon className="h-5 w-5 text-gray-500" />;
  }
};

export default function ResourceCard({ resource }) {
  return (
    <Card className="hover:shadow-xl transition-all group flex flex-col h-full border-gray-100 dark:border-zinc-800 rounded-2xl shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          {getIcon(resource.resource_type)}
          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 uppercase tracking-wider">
            {resource.category || 'General'}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1">
        <CardTitle className="text-lg line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {resource.title}
        </CardTitle>
        {resource.chunk_text && (
          <CardDescription className="line-clamp-3 text-sm italic border-l-2 border-primary pl-2 my-2">
            "{resource.chunk_text}"
          </CardDescription>
        )}
      </CardContent>
      
      <CardFooter className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <Button 
          variant="outline" 
          className="w-full justify-between hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
          onClick={() => window.open(resource.url, '_blank')}
        >
          <span>Open Resource</span>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
