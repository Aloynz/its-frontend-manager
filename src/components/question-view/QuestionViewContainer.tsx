"use client";

import { createSubmission } from "@/actions/createSubmission";
import { getCodeFeedback } from "@/actions/getCodeFeedback";
import QuestionViewFeedback, {
  FeedbackType,
} from "@/components/question-view//QuestionViewFeedback";
import QuestionViewEditor from "@/components/question-view/QuestionViewEditor";
import { Button, LoadingButton } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Course, Question, Submission, User } from "@prisma/client";
import { PutBlobResult } from "@vercel/blob";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function QuestionViewContainer({
  user,
  question,
}: {
  user: User;
  question: Question & { course: Course; submissions: Submission[] };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editorContent, setEditorContent] = useState("");
  const [shouldApplyDecorations, setShouldApplyDecorations] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackType[]>([]);

  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || "");
    setShouldApplyDecorations(false);
  };

  const handleFeedback = async () => {
    setIsChecking(true);
    const { status, feedback } = await getCodeFeedback({
      question: question,
      student_solution: editorContent,
    });

    if (status) {
      toast({
        title: status,
        variant: "destructive",
      });
    } else {
      setFeedbacks(feedback);
      setShouldApplyDecorations(true);
    }
    setIsChecking(false);
  };

  const handleSubmission = async () => {
    setIsSubmitting(true);
    try {
      const solFile = new File(
        [editorContent],
        `${user.id}_${question.id}.${question.language}`,
        { type: "text/plain" }
      );
      const response = await fetch(
        `/api/upload/program?filename=${solFile.name}`,
        {
          method: "POST",
          body: solFile,
        }
      );

      const newBlob = (await response.json()) as PutBlobResult;

      const newSubmission = await createSubmission({
        user: user,
        question: question,
        student_solution_url: newBlob.url,
      });

      if (!newSubmission) {
        throw new Error("Unable to create new submission");
      }

      toast({
        title: "Submission Successful",
        description: "Redirecting back to your course.",
        variant: "success",
      });

      router.push(
        `/courses/${question.course.code}/${question.id}/${newSubmission.id}`
      );
    } catch (error) {
      console.error(error);
      toast({
        title: "Submission Failed",
        description: "Please save your work and try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-[calc(100vh-100px)]"
    >
      <ResizablePanel defaultSize={30}>
        <div className="pr-4 h-full">
          <div className="h-5/6 flex flex-col space-y-2">
            <h1 className="text-2xl font-semibold">{question.title}</h1>
            <p>{question.description}</p>
          </div>
          <div className="h-1/6 flex items-end pb-4">
            <Link href={`/courses/${question.course.code}`}>
              <Button variant="secondary">Return to course</Button>
            </Link>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70}>
        <div className="h-full">
          <div className="h-3/5">
            <QuestionViewEditor
              language={question.language}
              handleEditorChange={handleEditorChange}
              feedback={feedbacks}
              shouldApplyDecorations={shouldApplyDecorations}
            />
          </div>
          <Separator />
          <div className="h-2/5 mt-4">
            <QuestionViewFeedback feedbacks={feedbacks} />
            <div className="flex items-end justify-end">
              <LoadingButton
                loading={isChecking}
                className="mr-2"
                onClick={() => handleFeedback()}
              >
                Run Check
              </LoadingButton>
              <LoadingButton
                loading={isSubmitting}
                onClick={() => handleSubmission()}
              >
                Submit Code
              </LoadingButton>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
